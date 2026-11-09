<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\CategoryType;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

class ItemApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        app(PermissionRegistrar::class)
            ->forgetCachedPermissions();
    }

    // Create the two required category values.
    private function createCategories(): array
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

        return [$laptop, $good];
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

    // A user whose permissions come through a role.
    private function userWithPermissions(array $names): User
    {
        foreach ($names as $name) {
            Permission::firstOrCreate([
                'name' => $name,
                'guard_name' => 'web',
            ]);
        }

        $role = Role::firstOrCreate([
            'name' => 'Test Editor',
            'guard_name' => 'web',
        ]);

        $role->syncPermissions($names);

        $user = User::factory()->create();

        $user->assignRole($role);

        return $user;
    }

    public function test_super_admin_can_create_item(): void
    {
        [$laptop, $good] = $this->createCategories();

        $admin = $this->superAdmin();

        Sanctum::actingAs($admin);

        $response = $this->postJson('/api/items', [
            'name' => 'Dell Latitude 5420',
            'category_id' => $laptop->id,
            'condition_category_id' => $good->id,
            'quantity' => 10,
            'description' => 'Office laptop',
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.quantity', 10)
            ->assertJsonPath('data.creator.id', $admin->id)
            ->assertJsonPath('data.category.name', 'Laptop')
            ->assertJsonPath('data.condition.name', 'Good');

        $this->assertDatabaseHas('items', [
            'name' => 'Dell Latitude 5420',
            'created_by' => $admin->id,
            'quantity' => 10,
        ]);
    }

    public function test_editor_cannot_create_positive_stock_without_permission(): void
    {
        [$laptop, $good] = $this->createCategories();

        $editor = $this->userWithPermissions([
            'items.create',
        ]);

        Sanctum::actingAs($editor);

        $payload = [
            'name' => 'HP Printer',
            'category_id' => $laptop->id,
            'condition_category_id' => $good->id,
            'quantity' => 5,
        ];

        // Editor lacks items.adjust-quantity.
        $this->postJson('/api/items', $payload)
            ->assertForbidden();

        // Starting with zero stock is allowed.
        $payload['quantity'] = 0;

        $this->postJson('/api/items', $payload)
            ->assertCreated()
            ->assertJsonPath('data.quantity', 0);
    }

    public function test_invalid_category_type_is_rejected(): void
    {
        [$laptop, $good] = $this->createCategories();

        Sanctum::actingAs($this->superAdmin());

        // Category and condition are intentionally reversed.
        $this->postJson('/api/items', [
            'name' => 'Invalid Item',
            'category_id' => $good->id,
            'condition_category_id' => $laptop->id,
        ])->assertUnprocessable();
    }

    public function test_item_update_tracks_last_updater(): void
    {
        [$laptop, $good] = $this->createCategories();

        $admin = $this->superAdmin();

        Sanctum::actingAs($admin);

        $itemId = $this->postJson('/api/items', [
            'name' => 'Dell Laptop',
            'category_id' => $laptop->id,
            'condition_category_id' => $good->id,
            'quantity' => 10,
        ])->json('data.id');

        $editor = $this->userWithPermissions([
            'items.update',
        ]);

        Sanctum::actingAs($editor);

        $this->patchJson("/api/items/{$itemId}", [
            'name' => 'Dell Laptop Updated',
        ])
            ->assertOk()
            ->assertJsonPath('data.updater.id', $editor->id)
            ->assertJsonPath('data.creator.id', $admin->id);

        // Cannot change stock through the details endpoint.
        $this->patchJson("/api/items/{$itemId}", [
            'quantity' => 999,
        ])->assertUnprocessable();

        $this->assertDatabaseHas('items', [
            'id' => $itemId,
            'created_by' => $admin->id,
            'updated_by' => $editor->id,
            'quantity' => 10,
        ]);
    }

    public function test_quantity_requires_separate_permission(): void
    {
        [$laptop, $good] = $this->createCategories();

        Sanctum::actingAs($this->superAdmin());

        $itemId = $this->postJson('/api/items', [
            'name' => 'Dell Laptop',
            'category_id' => $laptop->id,
            'condition_category_id' => $good->id,
            'quantity' => 5,
        ])->json('data.id');

        $editor = $this->userWithPermissions([
            'items.update',
        ]);

        Sanctum::actingAs($editor);

        $this->patchJson("/api/items/{$itemId}/quantity", [
            'quantity' => 30,
        ])->assertForbidden();

        // Grant permission to the same role dynamically.
        Permission::firstOrCreate([
            'name' => 'items.adjust-quantity',
            'guard_name' => 'web',
        ]);

        $editor->getRoleNames();

        $editor->roles->first()
            ->givePermissionTo('items.adjust-quantity');

        app(PermissionRegistrar::class)
            ->forgetCachedPermissions();

        $this->patchJson("/api/items/{$itemId}/quantity", [
            'quantity' => 30,
        ])
            ->assertOk()
            ->assertJsonPath('data.quantity', 30)
            ->assertJsonPath('data.updater.id', $editor->id);
    }

    public function test_unauthenticated_user_cannot_view_items(): void
    {
        $this->getJson('/api/items')
            ->assertUnauthorized();
    }
}
