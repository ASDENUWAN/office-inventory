<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

class PermissionManagementApiTest extends TestCase
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

    private function adminWithPermissions(
        array $names
    ): User {
        $role = Role::create([
            'name' => 'Admin',
            'guard_name' => 'web',
        ]);

        foreach ($names as $name) {
            Permission::firstOrCreate([
                'name' => $name,
                'guard_name' => 'web',
            ]);
        }

        $role->syncPermissions($names);

        $user = User::factory()->create();
        $user->assignRole($role);

        return $user;
    }

    public function test_super_admin_can_create_core_permission(): void
    {
        Sanctum::actingAs($this->superAdmin());

        $this->postJson('/api/permissions', [
            'name' => 'reports.export',
        ])
            ->assertCreated()
            ->assertJsonPath(
                'data.name',
                'reports.export'
            );

        $this->assertDatabaseHas('permissions', [
            'name' => 'reports.export',
            'guard_name' => 'web',
        ]);
    }

    public function test_admin_can_create_custom_permission(): void
    {
        $admin = $this->adminWithPermissions([
            'permissions.view',
            'permissions.create',
        ]);

        Sanctum::actingAs($admin);

        $this->postJson('/api/permissions', [
            'name' => 'custom.stock.audit',
        ])->assertCreated();

        $this->assertDatabaseHas('permissions', [
            'name' => 'custom.stock.audit',
            'guard_name' => 'web',
        ]);
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

    public function test_duplicate_permission_is_rejected(): void
    {
        Permission::create([
            'name' => 'custom.stock.audit',
            'guard_name' => 'web',
        ]);

        Sanctum::actingAs($this->superAdmin());

        $this->postJson('/api/permissions', [
            'name' => 'custom.stock.audit',
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('name');
    }

    public function test_core_permission_cannot_be_deleted(): void
    {
        $permission = Permission::create([
            'name' => 'items.view',
            'guard_name' => 'web',
        ]);

        Sanctum::actingAs($this->superAdmin());

        $this->deleteJson(
            "/api/permissions/{$permission->id}"
        )->assertForbidden();

        $this->assertDatabaseHas('permissions', [
            'id' => $permission->id,
        ]);
    }

    public function test_assigned_custom_permission_cannot_be_deleted(): void
    {
        $permission = Permission::create([
            'name' => 'custom.stock.audit',
            'guard_name' => 'web',
        ]);

        $role = Role::create([
            'name' => 'Auditor',
            'guard_name' => 'web',
        ]);

        $role->givePermissionTo($permission);

        Sanctum::actingAs($this->superAdmin());

        $this->deleteJson(
            "/api/permissions/{$permission->id}"
        )->assertStatus(409);

        $this->assertDatabaseHas('permissions', [
            'id' => $permission->id,
        ]);
    }

    public function test_unused_custom_permission_can_be_deleted(): void
    {
        $permission = Permission::create([
            'name' => 'custom.stock.audit',
            'guard_name' => 'web',
        ]);

        Sanctum::actingAs($this->superAdmin());

        $this->deleteJson(
            "/api/permissions/{$permission->id}"
        )->assertNoContent();

        $this->assertDatabaseMissing('permissions', [
            'id' => $permission->id,
        ]);
    }

    public function test_permission_list_includes_assignment_counts(): void
    {
        $assigned = Permission::create([
            'name' => 'custom.assigned',
            'guard_name' => 'web',
        ]);

        Permission::create([
            'name' => 'custom.unused',
            'guard_name' => 'web',
        ]);

        Permission::create([
            'name' => 'items.view',
            'guard_name' => 'web',
        ]);

        $role = Role::create([
            'name' => 'Auditor',
            'guard_name' => 'web',
        ]);

        $role->givePermissionTo($assigned);

        $userWithDirectPermission = User::factory()->create();
        $userWithDirectPermission->givePermissionTo($assigned);

        Sanctum::actingAs($this->superAdmin());

        $response = $this->getJson('/api/permissions')
            ->assertOk();

        $permissions = collect(
            $response->json('data')
        )->keyBy('name');

        $this->assertSame(
            1,
            $permissions['custom.assigned']['roles_count']
        );

        $this->assertSame(
            1,
            $permissions['custom.assigned']['users_count']
        );

        $this->assertFalse(
            $permissions['custom.assigned']['can_delete']
        );

        $this->assertTrue(
            $permissions['custom.unused']['can_delete']
        );

        $this->assertFalse(
            $permissions['items.view']['can_delete']
        );
    }

    public function test_user_without_create_permission_cannot_create(): void
    {
        $user = $this->adminWithPermissions([
            'permissions.view',
        ]);

        Sanctum::actingAs($user);

        $this->postJson('/api/permissions', [
            'name' => 'custom.test.feature',
        ])->assertForbidden();
    }

    public function test_guest_cannot_view_permissions(): void
    {
        $this->getJson('/api/permissions')
            ->assertUnauthorized();
    }
}
