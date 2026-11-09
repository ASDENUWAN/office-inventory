<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Http\Requests\StoreUserRequest;
use App\Http\Requests\UpdateUserRequest;
use App\Http\Requests\SyncUserRolesRequest;
use App\Support\RolePermissionGuard;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Spatie\Permission\Models\Role;

class UserController extends Controller
{
    // GET /api/users
    public function index(): JsonResponse
    {
        $users = User::with('roles')
            ->orderByDesc('id')
            ->paginate(10);

        $data = collect($users->items())
            ->map(fn(User $user) => $this->formatUser($user))
            ->values();

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

    // POST /api/users
    public function store(
        StoreUserRequest $request
    ): JsonResponse {
        $data = $request->validated();

        $user = User::create([
            'name' => $data['name'],
            'email' => $data['email'],
            'password' => $data['password'],
        ]);

        // A new user starts without any role.
        // Roles are assigned through a separate endpoint.

        return response()->json([
            'message' => 'User created successfully.',
            'data' => $this->formatUser($user),
        ], 201);
    }

    // GET /api/users/{user}
    public function show(User $user): JsonResponse
    {
        return response()->json([
            'data' => $this->formatUser($user),
        ]);
    }

    // PUT/PATCH /api/users/{user}
    public function update(
        UpdateUserRequest $request,
        User $user,
        RolePermissionGuard $guard
    ): JsonResponse {
        if (!$guard->canManageUser($request->user(), $user)) {
            abort(403, 'You cannot modify this user.');
        }

        $user->update($request->validated());

        return response()->json([
            'message' => 'User updated successfully.',
            'data' => $this->formatUser($user->fresh()),
        ]);
    }

    // PUT /api/users/{user}/roles
    public function syncRoles(
        SyncUserRolesRequest $request,
        User $user,
        RolePermissionGuard $guard
    ): JsonResponse {
        $actor = $request->user();

        // First check the target user's current access.
        if (!$guard->canManageUser($actor, $user)) {
            abort(403, 'You cannot manage this user.');
        }

        $roleIds = $request->validated('roles');

        // Retrieve the roles selected in the frontend.
        $roles = Role::where('guard_name', 'web')
            ->whereIn('id', $roleIds)
            ->get();

        // Check that every requested role is allowed.
        foreach ($roles as $role) {
            if (!$guard->canManageRole($actor, $role)) {
                abort(
                    403,
                    "You cannot assign the {$role->name} role."
                );
            }
        }

        // Replace existing user roles with selected roles.
        $user->syncRoles($roles);

        return response()->json([
            'message' => 'User roles updated successfully.',
            'data' => $this->formatUser($user->fresh()),
        ]);
    }

    // Return safe user information to React.
    private function formatUser(User $user): array
    {
        $user->loadMissing('roles');

        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,

            'roles' => $user->roles
                ->map(fn(Role $role) => [
                    'id' => $role->id,
                    'name' => $role->name,
                ])
                ->values()
                ->all(),

            'created_at' => $user->created_at,
        ];
    }

    /**
     * GET /api/users/assignable-roles
     *
     * Return only roles the authenticated user
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
            ->values();

        return response()->json([
            'data' => $roles,
        ]);
    }
}
