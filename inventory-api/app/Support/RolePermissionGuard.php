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

    // Check whether an administrator can grant a permission.
    public function canGrant(
        User $user,
        Permission $permission
    ): bool {
        if ($this->isSuperAdmin($user)) {
            return true;
        }

        if ($this->isCustomPermission($permission->name)) {
            return $user->can('permissions.assign');
        }

        return $user->can($permission->name);
    }

    // Check whether an administrator can manage a role.
    public function canManageRole(
        User $user,
        Role $role
    ): bool {
        // Super Admin is reserved.
        if ($role->name === 'Super Admin') {
            return false;
        }

        if ($role->guard_name !== 'web') {
            return false;
        }

        if ($this->isSuperAdmin($user)) {
            return true;
        }

        // Cannot manage roles containing permissions
        // beyond the administrator's authority.
        return $role->permissions()
            ->get()
            ->every(
                fn(Permission $permission) =>
                $this->canGrant($user, $permission)
            );
    }

    // NEW: Check whether an administrator can manage a user.
    public function canManageUser(
        User $actor,
        User $target
    ): bool {
        // Do not allow changing your own account
        // through administrative management endpoints.
        if ($actor->is($target)) {
            return false;
        }

        // Protect every Super Admin account.
        if ($target->hasRole('Super Admin')) {
            return false;
        }

        // Super Admin can manage other regular users.
        if ($this->isSuperAdmin($actor)) {
            return true;
        }

        // Check roles the target currently has.
        $canManageExistingRoles = $target->roles()
            ->get()
            ->every(
                fn(Role $role) =>
                $this->canManageRole($actor, $role)
            );

        if (!$canManageExistingRoles) {
            return false;
        }

        // Also protect users with direct permissions.
        return $target->getDirectPermissions()
            ->every(
                fn(Permission $permission) =>
                $this->canGrant($actor, $permission)
            );
    }
}
