<?php

namespace App\Support;

use App\Models\User;
use Spatie\Permission\Models\Role;
use Spatie\Permission\Models\Permission;

class RolePermissionGuard
{
    public function isSuperAdmin(User $user): bool
    {
        return $user->hasRole('Super Admin');
    }

    public function isCustomPermission(string $name): bool
    {
        return str_starts_with($name, 'custom.');
    }

    // Determine whether a user may grant a permission.
    public function canGrant(
        User $user,
        Permission $permission
    ): bool {
        if ($this->isSuperAdmin($user)) {
            return true;
        }

        // Delegated admins may grant custom permissions.
        if ($this->isCustomPermission($permission->name)) {
            return $user->can('permissions.assign');
        }

        // Otherwise, they must already have the permission.
        return $user->can($permission->name);
    }

    // Determine whether a role is manageable.
    public function canManageRole(
        User $user,
        Role $role
    ): bool {
        // Nobody may modify the reserved role here.
        if ($role->name === 'Super Admin') {
            return false;
        }

        if ($role->guard_name !== 'web') {
            return false;
        }

        if ($this->isSuperAdmin($user)) {
            return true;
        }

        // Admin cannot manage roles with privileges
        // that they are not allowed to grant.
        return $role->permissions()
            ->get()
            ->every(
                fn(Permission $permission) =>
                $this->canGrant($user, $permission)
            );
    }
}
