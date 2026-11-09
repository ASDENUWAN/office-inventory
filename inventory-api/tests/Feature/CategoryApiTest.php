<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\CategoryType;
use App\Models\Item;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class CategoryApiTest extends TestCase
{
    use RefreshDatabase;

    private function loginAsSuperAdmin(): void
    {
        Role::firstOrCreate([
            'name' => 'Super Admin',
            'guard_name' => 'web',
        ]);

        $user = User::factory()->create();

        $user->assignRole('Super Admin');

        Sanctum::actingAs($user);
    }

    public function test_super_admin_can_perform_category_crud(): void
    {
        $type = CategoryType::create([
            'name' => 'Item Category',
            'code' => 'ITEM_CATEGORY',
            'is_active' => true,
        ]);

        $this->loginAsSuperAdmin();

        // CREATE
        $response = $this->postJson('/api/categories', [
            'category_type_id' => $type->id,
            'name' => 'Laptop',
            'is_active' => true,
        ]);

        $response->assertStatus(201);

        $categoryId = $response->json('data.id');

        // READ
        $this->getJson("/api/categories/{$categoryId}")
            ->assertOk()
            ->assertJsonPath('data.name', 'Laptop');

        // FILTER
        $this->getJson('/api/categories?type=ITEM_CATEGORY&active_only=1')
            ->assertOk()
            ->assertJsonCount(1, 'data');

        // UPDATE
        $this->patchJson("/api/categories/{$categoryId}", [
            'name' => 'Laptop Computer',
        ])
            ->assertOk()
            ->assertJsonPath('data.name', 'Laptop Computer');

        // DELETE
        $this->deleteJson("/api/categories/{$categoryId}")
            ->assertNoContent();

        $this->assertDatabaseMissing('categories', [
            'id' => $categoryId,
        ]);
    }

    public function test_category_type_must_be_active(): void
    {
        $type = CategoryType::create([
            'name' => 'Inactive Type',
            'code' => 'INACTIVE_TYPE',
            'is_active' => false,
        ]);

        $this->loginAsSuperAdmin();

        $this->postJson('/api/categories', [
            'category_type_id' => $type->id,
            'name' => 'Test Category',
        ])->assertUnprocessable();
    }

    public function test_duplicate_name_in_same_type_is_rejected(): void
    {
        $type = CategoryType::create([
            'name' => 'Item Category',
            'code' => 'ITEM_CATEGORY',
        ]);

        Category::create([
            'category_type_id' => $type->id,
            'name' => 'Laptop',
        ]);

        $this->loginAsSuperAdmin();

        $this->postJson('/api/categories', [
            'category_type_id' => $type->id,
            'name' => 'Laptop',
        ])->assertUnprocessable();
    }

    public function test_category_used_by_item_cannot_be_deleted(): void
    {
        $itemType = CategoryType::create([
            'name' => 'Item Category',
            'code' => 'ITEM_CATEGORY',
        ]);

        $conditionType = CategoryType::create([
            'name' => 'Item Condition',
            'code' => 'ITEM_CONDITION',
        ]);

        $laptop = Category::create([
            'category_type_id' => $itemType->id,
            'name' => 'Laptop',
        ]);

        $good = Category::create([
            'category_type_id' => $conditionType->id,
            'name' => 'Good',
        ]);

        Item::create([
            'name' => 'Dell Laptop',
            'category_id' => $laptop->id,
            'condition_category_id' => $good->id,
            'quantity' => 2,
        ]);

        $this->loginAsSuperAdmin();

        $this->deleteJson("/api/categories/{$laptop->id}")
            ->assertStatus(409);

        $this->deleteJson("/api/categories/{$good->id}")
            ->assertStatus(409);
    }

    public function test_user_without_permission_cannot_create_category(): void
    {
        $type = CategoryType::create([
            'name' => 'Item Category',
            'code' => 'ITEM_CATEGORY',
        ]);

        $user = User::factory()->create();

        Sanctum::actingAs($user);

        $this->postJson('/api/categories', [
            'category_type_id' => $type->id,
            'name' => 'Laptop',
        ])->assertForbidden();
    }

    public function test_unauthenticated_user_cannot_view_categories(): void
    {
        $this->getJson('/api/categories')
            ->assertUnauthorized();
    }
}
