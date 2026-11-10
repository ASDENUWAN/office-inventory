<?php

namespace App\Http\Controllers;

use App\Http\Requests\StorePermissionRequest;
use App\Support\RolePermissionGuard;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Spatie\Permission\Models\Permission;
use Illuminate\Support\Facades\DB;

class PermissionController extends Controller
{

    public function index(
        Request $request,
        RolePermissionGuard $guard
    ): JsonResponse {
        $actor = $request->user();

        $canAssign = $actor->can('permissions.assign')
            && $actor->can('roles.update');

        $canDelete = $actor->can('permissions.delete');

        // Spatie's direct permission assignment table.
        $directTable = config(
            'permission.table_names.model_has_permissions',
            'model_has_permissions'
        );

        // Count direct permission assignments using
        // the pivot table instead of Permission::users().
        $directCounts = DB::table($directTable)
            ->select('permission_id')
            ->selectRaw('COUNT(*) AS total')
            ->groupBy('permission_id')
            ->pluck('total', 'permission_id');

        // withCount('roles') uses a normal relationship
        // and does not require dynamic user model resolution.
        $permissions = Permission::query()
            ->where('guard_name', 'web')
            ->withCount('roles')
            ->orderBy('name')
            ->get()
            ->map(function (Permission $permission) use (
                $actor,
                $guard,
                $canAssign,
                $canDelete,
                $directCounts
            ) {
                $isCustom = str_starts_with(
                    $permission->name,
                    'custom.'
                );

                // Direct assignments from the pivot table.
                $usersCount = (int) $directCounts->get(
                    $permission->id,
                    0
                );

                // Role assignment count from Eloquent.
                $rolesCount = (int) $permission->roles_count;

                $isAssigned = (
                    $rolesCount > 0 ||
                    $usersCount > 0
                );

                return [
                    'id' => $permission->id,
                    'name' => $permission->name,

                    'type' => $isCustom
                        ? 'custom'
                        : 'core',

                    'roles_count' => $rolesCount,

                    // Counts direct model assignments.
                    // Our application assigns these to users.
                    'users_count' => $usersCount,

                    'assignable' => $canAssign
                        && $guard->canGrant(
                            $actor,
                            $permission
                        ),

                    'can_delete' => $canDelete
                        && $isCustom
                        && !$isAssigned,
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
        // if (
        //     $permission->roles()->exists() ||
        //     $permission->users()->exists()
        // ) {
        //     return response()->json([
        //         'message' => 'Remove all permission assignments first.',
        //     ], 409);
        // }


        $directTable = config(
            'permission.table_names.model_has_permissions',
            'model_has_permissions'
        );

        $hasRoleAssignments = $permission
            ->roles()
            ->exists();

        $hasDirectAssignments = DB::table($directTable)
            ->where('permission_id', $permission->id)
            ->exists();

        if (
            $hasRoleAssignments ||
            $hasDirectAssignments
        ) {
            return response()->json([
                'message' => 'Remove all permission assignments first.',
            ], 409);
        }


        $permission->delete();

        return response()->json(null, 204);
    }
}
