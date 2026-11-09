<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreRoleRequest;
use App\Http\Requests\UpdateRoleRequest;
use App\Http\Requests\SyncRolePermissionsRequest;
use App\Support\RolePermissionGuard;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Spatie\Permission\Models\Role;
use Spatie\Permission\Models\Permission;

class RoleController extends Controller
{
    // GET /api/roles
    public function index(): JsonResponse
    {
        $roles = Role::with('permissions')
            ->where('guard_name', 'web')
            ->orderBy('name')
            ->get();

        return response()->json([
            'data' => $roles->map(
                fn(Role $role) => $this->formatRole($role)
            ),
        ]);
    }

    // POST /api/roles
    public function store(
        StoreRoleRequest $request
    ): JsonResponse {
        $name = $request->validated('name');

        if (strcasecmp($name, 'Super Admin') === 0) {
            return response()->json([
                'message' => 'This role name is reserved.',
            ], 403);
        }

        $role = Role::create([
            'name' => $name,
            'guard_name' => 'web',
        ]);

        return response()->json([
            'message' => 'Role created successfully.',
            'data' => $this->formatRole($role),
        ], 201);
    }

    // GET /api/roles/{role}
    public function show(Role $role): JsonResponse
    {
        $this->ensureWebRole($role);

        return response()->json([
            'data' => $this->formatRole($role),
        ]);
    }

    // PUT/PATCH /api/roles/{role}
    public function update(
        UpdateRoleRequest $request,
        Role $role,
        RolePermissionGuard $guard
    ): JsonResponse {
        $this->ensureWebRole($role);

        if (!$guard->canManageRole($request->user(), $role)) {
            abort(403, 'You cannot modify this role.');
        }

        $name = $request->validated('name');

        if (strcasecmp($name, 'Super Admin') === 0) {
            abort(403, 'This role name is reserved.');
        }

        $role->update([
            'name' => $name,
        ]);

        return response()->json([
            'message' => 'Role updated successfully.',
            'data' => $this->formatRole($role->fresh()),
        ]);
    }

    // DELETE /api/roles/{role}
    public function destroy(
        Request $request,
        Role $role,
        RolePermissionGuard $guard
    ): JsonResponse {
        $this->ensureWebRole($role);

        if (!$guard->canManageRole($request->user(), $role)) {
            abort(403, 'You cannot delete this role.');
        }

        // Prevent deletion of roles assigned to users.
        if ($role->users()->exists()) {
            return response()->json([
                'message' => 'Remove the role from its users first.',
            ], 409);
        }

        $role->delete();

        return response()->json(null, 204);
    }

    // PUT /api/roles/{role}/permissions
    public function syncPermissions(
        SyncRolePermissionsRequest $request,
        Role $role,
        RolePermissionGuard $guard
    ): JsonResponse {
        $this->ensureWebRole($role);

        $user = $request->user();

        if (!$guard->canManageRole($user, $role)) {
            abort(403, 'You cannot manage this role.');
        }

        $names = $request->validated('permissions');

        // Retrieve the actual registered permissions.
        $permissions = Permission::where('guard_name', 'web')
            ->whereIn('name', $names)
            ->get();

        // Check every requested permission.
        foreach ($permissions as $permission) {
            if (!$guard->canGrant($user, $permission)) {
                abort(
                    403,
                    "You cannot grant {$permission->name}."
                );
            }
        }

        // Replace the role's complete permission list.
        $role->syncPermissions($names);

        return response()->json([
            'message' => 'Role permissions updated successfully.',
            'data' => $this->formatRole($role->fresh()),
        ]);
    }

    private function ensureWebRole(Role $role): void
    {
        abort_unless($role->guard_name === 'web', 404);
    }

    private function formatRole(Role $role): array
    {
        $role->loadMissing('permissions');

        return [
            'id' => $role->id,
            'name' => $role->name,
            'permissions' => $role->permissions
                ->pluck('name')
                ->sort()
                ->values()
                ->all(),
        ];
    }
}
