<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Http\Requests\StoreUserRequest;
use App\Http\Requests\UpdateUserRequest;
use App\Http\Requests\SyncUserRolesRequest;
use App\Http\Requests\SyncUserPermissionsRequest;
use App\Support\RolePermissionGuard;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Spatie\Permission\Models\Role;
use Spatie\Permission\Models\Permission;

class UserController extends Controller
{
    /**
     * GET /api/users
     *
     * Get paginated users with:
     * - Assigned roles
     * - Direct permissions
     * - Permissions inherited from roles
     * - Whether the current user can manage them
     */
    public function index(
        Request $request,
        RolePermissionGuard $guard
    ): JsonResponse {

        $actor = $request->user();

        $users = User::with([
            'roles.permissions',
            'permissions',
        ])
            ->orderByDesc('id')
            ->paginate(10);

        $data = collect($users->items())
            ->map(function (User $user) use ($actor, $guard) {
                return [
                    ...$this->formatUser($user),

                    'can_manage' => $guard->canManageUser(
                        $actor,
                        $user
                    ),
                ];
            })
            ->values()
            ->all();

        return response()->json([
            'data' => $data,

            'meta' => [
                'current_page' => $users->currentPage(),
                'last_page' => $users->lastPage(),
                'per_page' => $users->perPage(),
                'total' => $users->total(),
            ],
        ]);
    }

    /**
     * POST /api/users
     *
     * Create a new user.
     * The user starts without roles or permissions.
     */
    public function store(
        StoreUserRequest $request
    ): JsonResponse {

        $data = $request->validated();

        $user = User::create([
            'name' => $data['name'],
            'email' => $data['email'],
            'password' => $data['password'],
        ]);

        // Roles and permissions are assigned
        // through separate authorized endpoints.

        return response()->json([
            'message' => 'User created successfully.',
            'data' => $this->formatUser($user),
        ], 201);
    }

    /**
     * GET /api/users/{user}
     *
     * Get one user and their permission details.
     */
    public function show(
        Request $request,
        User $user,
        RolePermissionGuard $guard
    ): JsonResponse {

        return response()->json([
            'data' => [
                ...$this->formatUser($user),

                'can_manage' => $guard->canManageUser(
                    $request->user(),
                    $user
                ),
            ],
        ]);
    }

    /**
     * PUT/PATCH /api/users/{user}
     *
     * Update the user's basic information.
     */
    public function update(
        UpdateUserRequest $request,
        User $user,
        RolePermissionGuard $guard
    ): JsonResponse {

        $actor = $request->user();

        if (!$guard->canManageUser($actor, $user)) {
            abort(
                403,
                'You cannot modify this user.'
            );
        }

        // Only validated fields are updated.
        // Roles and permissions are managed separately.
        $user->update($request->validated());

        return response()->json([
            'message' => 'User updated successfully.',
            'data' => $this->formatUser($user->fresh()),
        ]);
    }

    /**
     * GET /api/users/assignable-roles
     *
     * Get roles that the authenticated user
     * is authorized to assign.
     */
    public function assignableRoles(
        Request $request,
        RolePermissionGuard $guard
    ): JsonResponse {

        $actor = $request->user();

        $roles = Role::query()
            ->where('guard_name', 'web')
            ->where('name', '!=', 'Super Admin')
            ->orderBy('name')
            ->get()
            ->filter(
                fn(Role $role) =>
                $guard->canManageRole($actor, $role)
            )
            ->map(fn(Role $role) => [
                'id' => $role->id,
                'name' => $role->name,
            ])
            ->values()
            ->all();

        return response()->json([
            'data' => $roles,
        ]);
    }

    /**
     * PUT /api/users/{user}/roles
     *
     * Replace the user's assigned roles.
     *
     * Direct user permissions remain unchanged.
     */
    public function syncRoles(
        SyncUserRolesRequest $request,
        User $user,
        RolePermissionGuard $guard
    ): JsonResponse {

        $actor = $request->user();

        // Check permission to manage the target user.
        if (!$guard->canManageUser($actor, $user)) {
            abort(
                403,
                'You cannot manage this user.'
            );
        }

        $roleIds = $request->validated('roles');

        // Get the roles selected by React.
        $roles = Role::query()
            ->where('guard_name', 'web')
            ->whereIn('id', $roleIds)
            ->get();

        // Verify every requested role before saving.
        foreach ($roles as $role) {

            if (!$guard->canManageRole($actor, $role)) {
                abort(
                    403,
                    "You cannot assign the {$role->name} role."
                );
            }
        }

        // Replace assigned roles.
        // Direct user permissions remain untouched.
        $user->syncRoles($roles);

        return response()->json([
            'message' => 'User roles updated successfully.',
            'data' => $this->formatUser($user->fresh()),
        ]);
    }

    /**
     * GET /api/users/assignable-permissions
     *
     * Get permissions that the authenticated user
     * is authorized to grant directly.
     */
    public function assignablePermissions(
        Request $request,
        RolePermissionGuard $guard
    ): JsonResponse {

        $actor = $request->user();

        $permissions = Permission::query()
            ->where('guard_name', 'web')
            ->orderBy('name')
            ->get()
            ->filter(
                fn(Permission $permission) =>
                $guard->canGrant($actor, $permission)
            )
            ->map(fn(Permission $permission) => [
                'id' => $permission->id,
                'name' => $permission->name,
            ])
            ->values()
            ->all();

        return response()->json([
            'data' => $permissions,
        ]);
    }

    /**
     * PUT /api/users/{user}/permissions
     *
     * Replace DIRECT user permissions only.
     *
     * Permissions inherited from roles
     * are NOT modified.
     */
    public function syncPermissions(
        SyncUserPermissionsRequest $request,
        User $user,
        RolePermissionGuard $guard
    ): JsonResponse {

        $actor = $request->user();

        // Protect accounts that the actor
        // is not authorized to manage.
        if (!$guard->canManageUser($actor, $user)) {
            abort(
                403,
                'You cannot manage permissions for this user.'
            );
        }

        // Validated array of permission names.
        $names = $request->validated('permissions');

        // Retrieve requested permissions.
        $requested = Permission::query()
            ->where('guard_name', 'web')
            ->whereIn('name', $names)
            ->get();

        // SECURITY CHECK 1:
        // The actor must be authorized to grant
        // every requested permission.
        foreach ($requested as $permission) {

            if (!$guard->canGrant($actor, $permission)) {
                abort(
                    403,
                    "You cannot grant {$permission->name}."
                );
            }
        }

        // SECURITY CHECK 2:
        // The actor must not remove existing
        // direct permissions outside their authority.
        $existing = $user->getDirectPermissions();

        foreach ($existing as $permission) {

            if (!$guard->canGrant($actor, $permission)) {
                abort(
                    403,
                    "You cannot modify {$permission->name}."
                );
            }
        }

        // IMPORTANT:
        // Replaces DIRECT permissions only.
        //
        // Permissions inherited from assigned
        // roles remain unchanged.
        $user->syncPermissions($requested);

        $user->refresh();

        return response()->json([
            'message' =>
            'User direct permissions updated successfully.',

            'data' => $this->formatUser($user),
        ]);
    }

    /**
     * Format user information for React.
     *
     * Returns roles, direct permissions,
     * and inherited permissions separately.
     */
    private function formatUser(User $user): array
    {
        // Eager load the relationships required
        // to calculate both permission sources.
        $user->loadMissing([
            'roles.permissions',
            'permissions',
        ]);

        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,

            // Assigned roles.
            'roles' => $user->roles
                ->map(fn(Role $role) => [
                    'id' => $role->id,
                    'name' => $role->name,
                ])
                ->values()
                ->all(),

            // Permissions assigned directly
            // to this user, not through roles.
            'direct_permissions' => $user
                ->getDirectPermissions()
                ->pluck('name')
                ->unique()
                ->sort()
                ->values()
                ->all(),

            // Permissions inherited from
            // one or more assigned roles.
            'inherited_permissions' => $user
                ->getPermissionsViaRoles()
                ->pluck('name')
                ->unique()
                ->sort()
                ->values()
                ->all(),

            'created_at' => $user->created_at,
        ];
    }
}
