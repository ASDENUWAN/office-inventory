<?php

namespace Tests\Feature;


use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

class RolePermissionApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        app(PermissionRegistrar::class)
            ->forgetCachedPermissions();
    }

    private function superAdmin(): User
    {
        $role = Role::firstOrCreate([
            'name' => 'Super Admin',
            'guard_name' => 'web',
        ]);

        $user = User::factory()->create();

        $user->assignRole($role);

        return $user;
    }

    private function adminWithPermissions(array $names): User
    {
        $role = Role::create([
            'name' => 'Admin',
            'guard_name' => 'web',
        ]);

        foreach ($names as $name) {
            $permission = Permission::firstOrCreate([
                'name' => $name,
                'guard_name' => 'web',
            ]);

            $role->givePermissionTo($permission);
        }

        $user = User::factory()->create();

        $user->assignRole($role);

        return $user;
    }

    public function test_super_admin_can_create_role_and_assign_permissions(): void
    {
        Sanctum::actingAs($this->superAdmin());

        Permission::firstOrCreate([
            'name' => 'items.view',
            'guard_name' => 'web',
        ]);

        $response = $this->postJson('/api/roles', [
            'name' => 'Stock Manager',
        ])->assertCreated();

        $roleId = $response->json('data.id');

        $this->putJson("/api/roles/{$roleId}/permissions", [
            'permissions' => ['items.view'],
        ])
            ->assertOk()
            ->assertJsonPath(
                'data.permissions.0',
                'items.view'
            );

        $this->assertTrue(
            Role::findById($roleId, 'web')
                ->hasPermissionTo('items.view')
        );
    }

    public function test_admin_can_create_custom_permission_and_role(): void
    {
        $admin = $this->adminWithPermissions([
            'roles.create',
            'roles.update',
            'permissions.create',
            'permissions.assign',
            'items.view',
        ]);

        Sanctum::actingAs($admin);

        $this->postJson('/api/permissions', [
            'name' => 'custom.reports.export',
        ])->assertCreated();

        $roleId = $this->postJson('/api/roles', [
            'name' => 'Stock Auditor',
        ])->assertCreated()->json('data.id');

        $this->putJson("/api/roles/{$roleId}/permissions", [
            'permissions' => [
                'items.view',
                'custom.reports.export',
            ],
        ])->assertOk();

        $this->assertTrue(
            Role::findById($roleId, 'web')
                ->hasPermissionTo('custom.reports.export')
        );
    }

    public function test_admin_cannot_grant_permission_they_do_not_have(): void
    {
        $admin = $this->adminWithPermissions([
            'roles.create',
            'roles.update',
            'permissions.assign',
            'items.view',
        ]);

        Permission::firstOrCreate([
            'name' => 'items.delete',
            'guard_name' => 'web',
        ]);

        Sanctum::actingAs($admin);

        $roleId = $this->postJson('/api/roles', [
            'name' => 'Stock Editor',
        ])->assertCreated()->json('data.id');

        $this->putJson("/api/roles/{$roleId}/permissions", [
            'permissions' => [
                'items.view',
                'items.delete',
            ],
        ])->assertForbidden();

        $this->assertFalse(
            Role::findById($roleId, 'web')
                ->hasPermissionTo('items.delete')
        );
    }

    public function test_admin_cannot_create_core_permission(): void
    {
        $admin = $this->adminWithPermissions([
            'permissions.create',
        ]);

        Sanctum::actingAs($admin);

        $this->postJson('/api/permissions', [
            'name' => 'reports.export',
        ])->assertForbidden();

        $this->assertDatabaseMissing('permissions', [
            'name' => 'reports.export',
        ]);
    }

    public function test_super_admin_role_cannot_be_modified(): void
    {
        $superAdmin = $this->superAdmin();

        Sanctum::actingAs($superAdmin);

        $role = Role::findByName('Super Admin', 'web');

        $this->patchJson("/api/roles/{$role->id}", [
            'name' => 'New Owner',
        ])->assertForbidden();

        $this->deleteJson("/api/roles/{$role->id}")
            ->assertForbidden();

        $this->putJson("/api/roles/{$role->id}/permissions", [
            'permissions' => [],
        ])->assertForbidden();
    }

    public function test_assigned_role_cannot_be_deleted(): void
    {
        $superAdmin = $this->superAdmin();

        $role = Role::create([
            'name' => 'Viewer',
            'guard_name' => 'web',
        ]);

        $user = User::factory()->create();

        $user->assignRole($role);

        Sanctum::actingAs($superAdmin);

        $this->deleteJson("/api/roles/{$role->id}")
            ->assertStatus(409);
    }

    public function test_custom_permission_must_be_unassigned_before_deletion(): void
    {
        Sanctum::actingAs($this->superAdmin());

        $permission = Permission::create([
            'name' => 'custom.stock.audit',
            'guard_name' => 'web',
        ]);

        $role = Role::create([
            'name' => 'Auditor',
            'guard_name' => 'web',
        ]);

        $role->givePermissionTo($permission);

        $this->deleteJson("/api/permissions/{$permission->id}")
            ->assertStatus(409);

        $role->syncPermissions([]);

        $this->deleteJson("/api/permissions/{$permission->id}")
            ->assertNoContent();
    }

    public function test_unauthorized_user_cannot_create_roles(): void
    {
        $user = User::factory()->create();

        Sanctum::actingAs($user);

        $this->postJson('/api/roles', [
            'name' => 'Unauthorized Role',
        ])->assertForbidden();
    }

    public function test_guest_cannot_view_roles(): void
    {
        $this->getJson('/api/roles')
            ->assertUnauthorized();
    }

    public function test_admin_can_load_assignable_permissions_without_permissions_view(): void
    {
        $admin = $this->adminWithPermissions([
            'roles.update',
            'permissions.assign',
            'items.view',
        ]);

        Permission::create([
            'name' => 'items.delete',
            'guard_name' => 'web',
        ]);

        Permission::create([
            'name' => 'custom.stock.audit',
            'guard_name' => 'web',
        ]);

        Sanctum::actingAs($admin);

        // This Admin cannot browse the full permissions API.
        $this->getJson('/api/permissions')
            ->assertForbidden();

        // But they can request assignable options.
        $response = $this->getJson(
            '/api/roles/assignable-permissions'
        )->assertOk();

        $names = collect($response->json('data'))
            ->pluck('name')
            ->all();

        $this->assertContains('items.view', $names);

        $this->assertContains(
            'custom.stock.audit',
            $names
        );

        $this->assertNotContains(
            'items.delete',
            $names
        );
    }

    public function test_roles_list_indicates_which_roles_admin_can_manage(): void
    {
        $admin = $this->adminWithPermissions([
            'roles.view',
            'items.view',
        ]);

        $viewer = Role::create([
            'name' => 'Viewer',
            'guard_name' => 'web',
        ]);

        $viewer->givePermissionTo('items.view');

        $deletePermission = Permission::create([
            'name' => 'items.delete',
            'guard_name' => 'web',
        ]);

        $privilegedRole = Role::create([
            'name' => 'Stock Deleter',
            'guard_name' => 'web',
        ]);

        $privilegedRole->givePermissionTo(
            $deletePermission
        );

        Role::firstOrCreate([
            'name' => 'Super Admin',
            'guard_name' => 'web',
        ]);

        Sanctum::actingAs($admin);

        $response = $this->getJson('/api/roles')
            ->assertOk();

        $roles = collect($response->json('data'));

        $this->assertTrue(
            $roles->firstWhere('name', 'Viewer')['can_manage']
        );

        $this->assertFalse(
            $roles->firstWhere('name', 'Stock Deleter')['can_manage']
        );

        $this->assertFalse(
            $roles->firstWhere('name', 'Super Admin')['can_manage']
        );
    }

    public function test_user_without_assignment_permission_cannot_load_options(): void
    {
        $user = $this->adminWithPermissions([
            'roles.view',
            'roles.update',
        ]);

        Sanctum::actingAs($user);

        $this->getJson('/api/roles/assignable-permissions')
            ->assertForbidden();
    }
}
