<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Spatie\Permission\Models\Role;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

class AuthApiTest extends TestCase
{
    use RefreshDatabase;

    // Simulate requests from our React frontend.
    private function frontendHeaders(): static
    {
        return $this->withHeaders([
            'Origin' => 'http://127.0.0.1:5173',
            'Referer' => 'http://127.0.0.1:5173/',
            'Accept' => 'application/json',
        ]);
    }

    public function test_super_admin_can_login(): void
    {
        Role::firstOrCreate([
            'name' => 'Super Admin',
            'guard_name' => 'web',
        ]);

        Permission::firstOrCreate([
            'name' => 'items.view',
            'guard_name' => 'web',
        ]);

        $user = User::factory()->create([
            'email' => 'admin@example.com',
            'password' => Hash::make('TestPassword123!'),
        ]);

        $user->assignRole('Super Admin');

        $response = $this->frontendHeaders()
            ->postJson('/api/login', [
                'email' => 'admin@example.com',
                'password' => 'TestPassword123!',
            ]);

        $response->assertOk()
            ->assertJsonPath('user.email', 'admin@example.com')
            ->assertJsonPath('is_super_admin', true)
            ->assertJsonPath('permissions.0', 'items.view');

        $this->assertAuthenticatedAs($user, 'web');
    }

    public function test_invalid_password_is_rejected(): void
    {
        User::factory()->create([
            'email' => 'editor@example.com',
            'password' => Hash::make('CorrectPassword123!'),
        ]);

        $this->frontendHeaders()
            ->postJson('/api/login', [
                'email' => 'editor@example.com',
                'password' => 'WrongPassword123!',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('email');

        $this->assertGuest('web');
    }

    public function test_authenticated_user_can_view_roles_and_permissions(): void
    {
        $permission = Permission::firstOrCreate([
            'name' => 'items.view',
            'guard_name' => 'web',
        ]);

        $role = Role::firstOrCreate([
            'name' => 'Viewer',
            'guard_name' => 'web',
        ]);

        $role->givePermissionTo($permission);
        /** @var User $user */
        $user = User::factory()->create();

        $user->assignRole($role);

        // Simulate an already authenticated user.
        $this->actingAs($user, 'web');

        $this->frontendHeaders()
            ->getJson('/api/me')
            ->assertOk()
            ->assertJsonPath('user.id', $user->id)
            ->assertJsonPath('roles.0', 'Viewer')
            ->assertJsonPath('permissions.0', 'items.view')
            ->assertJsonPath('is_super_admin', false);
    }

    public function test_unauthenticated_user_cannot_view_profile(): void
    {
        $this->getJson('/api/me')
            ->assertUnauthorized();
    }

    public function test_authenticated_user_can_logout(): void
    {
        /** @var User $user */
        $user = User::factory()->create();

        $this->actingAs($user, 'web');

        $this->frontendHeaders()
            ->postJson('/api/logout')
            ->assertOk()
            ->assertJsonPath(
                'message',
                'Logout successful.'
            );

        $this->assertGuest('web');
    }
}
