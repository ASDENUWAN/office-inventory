<?php

namespace App\Http\Controllers;

use App\Http\Requests\StorePermissionRequest;
use App\Support\RolePermissionGuard;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Spatie\Permission\Models\Permission;

class PermissionController extends Controller
{
    // GET /api/permissions
    public function index(
        Request $request,
        RolePermissionGuard $guard
    ): JsonResponse {
        $user = $request->user();

        $canAssign = $user->can('permissions.assign')
            && $user->can('roles.update');

        $permissions = Permission::where('guard_name', 'web')
            ->orderBy('name')
            ->get()
            ->map(function (Permission $permission) use (
                $user,
                $guard,
                $canAssign
            ) {
                return [
                    'id' => $permission->id,
                    'name' => $permission->name,
                    'assignable' => $canAssign
                        && $guard->canGrant($user, $permission),
                ];
            });

        return response()->json([
            'data' => $permissions,
        ]);
    }

    // POST /api/permissions
    public function store(
        StorePermissionRequest $request,
        RolePermissionGuard $guard
    ): JsonResponse {
        $name = $request->validated('name');

        // Admins may register custom permissions only.
        if (
            !$guard->isSuperAdmin($request->user()) &&
            !$guard->isCustomPermission($name)
        ) {
            return response()->json([
                'message' => 'Only Super Admin can create core permissions.',
            ], 403);
        }

        $permission = Permission::create([
            'name' => $name,
            'guard_name' => 'web',
        ]);

        return response()->json([
            'message' => 'Permission created successfully.',
            'data' => [
                'id' => $permission->id,
                'name' => $permission->name,
            ],
        ], 201);
    }

    // GET /api/permissions/{permission}
    public function show(Permission $permission): JsonResponse
    {
        abort_unless($permission->guard_name === 'web', 404);

        return response()->json([
            'data' => [
                'id' => $permission->id,
                'name' => $permission->name,
            ],
        ]);
    }

    // DELETE /api/permissions/{permission}
    public function destroy(Permission $permission): JsonResponse
    {
        abort_unless($permission->guard_name === 'web', 404);

        // Protect core application permissions.
        if (!str_starts_with($permission->name, 'custom.')) {
            return response()->json([
                'message' => 'Core permissions cannot be deleted.',
            ], 403);
        }

        // Do not delete permissions assigned to users or roles.
        if (
            $permission->roles()->exists() ||
            $permission->users()->exists()
        ) {
            return response()->json([
                'message' => 'Remove all permission assignments first.',
            ], 409);
        }

        $permission->delete();

        return response()->json(null, 204);
    }
}
