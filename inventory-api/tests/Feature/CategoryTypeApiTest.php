<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class CategoryTypeApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_super_admin_can_create_category_type(): void
    {
        Role::firstOrCreate([
            'name' => 'Super Admin',
            'guard_name' => 'web',
        ]);

        $user = User::factory()->create();

        $user->assignRole('Super Admin');

        // Simulate an authenticated Super Admin.
        Sanctum::actingAs($user);

        $response = $this->postJson('/api/category-types', [
            'name' => 'Warranty Status',
            'code' => 'WARRANTY_STATUS',
            'description' => 'Tracks warranty status',
            'is_active' => true,
        ]);

        $response->assertStatus(201);

        $response->assertJsonPath(
            'data.code',
            'WARRANTY_STATUS'
        );

        $this->assertDatabaseHas('category_types', [
            'name' => 'Warranty Status',
            'code' => 'WARRANTY_STATUS',
        ]);
    }

    public function test_unauthenticated_user_cannot_create_category_type(): void
    {
        $response = $this->postJson('/api/category-types', [
            'name' => 'Warranty Status',
            'code' => 'WARRANTY_STATUS',
        ]);

        $response->assertStatus(401);
    }
}
