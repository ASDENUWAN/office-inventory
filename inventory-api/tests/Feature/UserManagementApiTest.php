<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

class UserManagementApiTest extends TestCase
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
        Role::firstOrCreate([
            'name' => 'Super Admin',
            'guard_name' => 'web',
        ]);

        $user = User::factory()->create();

        $user->assignRole('Super Admin');

        return $user;
    }

    private function adminWithPermissions(array $names): User
    {
        foreach ($names as $name) {
            Permission::firstOrCreate([
                'name' => $name,
                'guard_name' => 'web',
            ]);
        }

        $role = Role::firstOrCreate([
            'name' => 'Admin',
            'guard_name' => 'web',
        ]);

        $role->syncPermissions($names);

        $user = User::factory()->create();

        $user->assignRole($role);

        return $user;
    }

    public function test_super_admin_can_create_user_and_assign_role(): void
    {
        $adminRole = Role::create([
            'name' => 'Admin',
            'guard_name' => 'web',
        ]);

        $permission = Permission::create([
            'name' => 'items.view',
            'guard_name' => 'web',
        ]);

        $adminRole->givePermissionTo($permission);

        Sanctum::actingAs($this->superAdmin());

        // CREATE USER
        $response = $this->postJson('/api/users', [
            'name' => 'Kasun Perera',
            'email' => 'kasun@example.com',
            'password' => 'ExamplePassword123!',
            'password_confirmation' => 'ExamplePassword123!',
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.email', 'kasun@example.com')
            ->assertJsonCount(0, 'data.roles')
            ->assertJsonMissingPath('data.password');

        $userId = $response->json('data.id');

        $createdUser = User::findOrFail($userId);

        $this->assertTrue(
            Hash::check(
                'ExamplePassword123!',
                $createdUser->password
            )
        );

        // ASSIGN ADMIN ROLE
        $this->putJson("/api/users/{$userId}/roles", [
            'roles' => [$adminRole->id],
        ])
            ->assertOk()
            ->assertJsonPath('data.roles.0.name', 'Admin');

        $this->assertTrue(
            $createdUser->fresh()->hasRole('Admin')
        );

        $this->assertTrue(
            $createdUser->fresh()->can('items.view')
        );
    }

    public function test_authorized_admin_can_assign_permitted_role(): void
    {
        $admin = $this->adminWithPermissions([
            'users.assign-roles',
            'items.view',
        ]);

        $viewer = Role::create([
            'name' => 'Viewer',
            'guard_name' => 'web',
        ]);

        $viewer->givePermissionTo('items.view');

        $target = User::factory()->create();

        Sanctum::actingAs($admin);

        $this->putJson("/api/users/{$target->id}/roles", [
            'roles' => [$viewer->id],
        ])->assertOk();

        $this->assertTrue(
            $target->fresh()->hasRole('Viewer')
        );
    }

    public function test_admin_cannot_assign_more_privileged_role(): void
    {
        $admin = $this->adminWithPermissions([
            'users.assign-roles',
            'items.view',
        ]);

        $permission = Permission::create([
            'name' => 'items.delete',
            'guard_name' => 'web',
        ]);

        $privilegedRole = Role::create([
            'name' => 'Stock Controller',
            'guard_name' => 'web',
        ]);

        $privilegedRole->givePermissionTo($permission);

        $target = User::factory()->create();

        Sanctum::actingAs($admin);

        $this->putJson("/api/users/{$target->id}/roles", [
            'roles' => [$privilegedRole->id],
        ])->assertForbidden();

        $this->assertFalse(
            $target->fresh()->hasRole('Stock Controller')
        );
    }

    public function test_admin_cannot_remove_higher_privileged_role(): void
    {
        $admin = $this->adminWithPermissions([
            'users.assign-roles',
        ]);

        $permission = Permission::create([
            'name' => 'items.delete',
            'guard_name' => 'web',
        ]);

        $role = Role::create([
            'name' => 'Inventory Manager',
            'guard_name' => 'web',
        ]);

        $role->givePermissionTo($permission);

        $target = User::factory()->create();
        $target->assignRole($role);

        Sanctum::actingAs($admin);

        $this->putJson("/api/users/{$target->id}/roles", [
            'roles' => [],
        ])->assertForbidden();

        $this->assertTrue(
            $target->fresh()->hasRole('Inventory Manager')
        );
    }

    public function test_super_admin_account_is_protected(): void
    {
        $owner = $this->superAdmin();

        $protectedUser = User::factory()->create();
        $protectedUser->assignRole('Super Admin');

        Sanctum::actingAs($owner);

        $this->patchJson("/api/users/{$protectedUser->id}", [
            'name' => 'Changed Name',
        ])->assertForbidden();

        $this->putJson("/api/users/{$protectedUser->id}/roles", [
            'roles' => [],
        ])->assertForbidden();
    }

    public function test_admin_cannot_change_own_roles(): void
    {
        $admin = $this->adminWithPermissions([
            'users.assign-roles',
        ]);

        Sanctum::actingAs($admin);

        $this->putJson("/api/users/{$admin->id}/roles", [
            'roles' => [],
        ])->assertForbidden();

        $this->assertTrue(
            $admin->fresh()->hasRole('Admin')
        );
    }

    public function test_super_admin_can_update_regular_user(): void
    {
        $target = User::factory()->create([
            'email' => 'editor@example.com',
        ]);

        Sanctum::actingAs($this->superAdmin());

        $this->patchJson("/api/users/{$target->id}", [
            'name' => 'Updated Editor',
        ])
            ->assertOk()
            ->assertJsonPath(
                'data.name',
                'Updated Editor'
            );

        $this->assertDatabaseHas('users', [
            'id' => $target->id,
            'name' => 'Updated Editor',
        ]);

        // Password changes aren't allowed here.
        $this->patchJson("/api/users/{$target->id}", [
            'password' => 'AnotherPassword123!',
        ])->assertUnprocessable();
    }

    public function test_user_without_permissions_cannot_create_user(): void
    {
        $user = User::factory()->create();

        Sanctum::actingAs($user);

        $this->postJson('/api/users', [
            'name' => 'New User',
            'email' => 'new@example.com',
            'password' => 'ExamplePassword123!',
            'password_confirmation' => 'ExamplePassword123!',
        ])->assertForbidden();
    }

    public function test_guest_cannot_view_users(): void
    {
        $this->getJson('/api/users')
            ->assertUnauthorized();
    }
}
