<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Role;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\PermissionRegistrar;

class RolePermissionSeeder extends Seeder
{
    public function run(): void
    {
        // Clear Spatie's cached permissions.
        app(PermissionRegistrar::class)
            ->forgetCachedPermissions();

        // Initial permissions supported by our application.
        $permissions = [

            // Inventory item permissions
            'items.view',
            'items.create',
            'items.update',
            'items.delete',
            'items.adjust-quantity',

            // Category permissions
            'categories.view',
            'categories.create',
            'categories.update',
            'categories.delete',

            // Category type permissions
            'category-types.manage',


            // User management permissions
            'users.view',
            'users.create',
            'users.update',
            'users.assign-roles',


            // Role management permissions
            'roles.view',
            'roles.create',
            'roles.update',
            'roles.delete',

            // Permission management permissions
            'permissions.view',
            'permissions.create',
            'permissions.assign',
            'permissions.delete',
        ];

        // Insert initial permissions.
        foreach ($permissions as $permissionName) {

            Permission::firstOrCreate([
                'name' => $permissionName,
                'guard_name' => 'web',
            ]);
        }

        // Create only the Super Admin role.
        Role::firstOrCreate([
            'name' => 'Super Admin',
            'guard_name' => 'web',
        ]);

        // Clear cache after changes.
        app(PermissionRegistrar::class)
            ->forgetCachedPermissions();
    }
}
