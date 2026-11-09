<?php

namespace Tests\Feature;

use App\Models\CategoryType;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

class CategoryTypeOptionsApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        app(PermissionRegistrar::class)
            ->forgetCachedPermissions();
    }

    private function loginAsCategoryViewer(): void
    {
        $permission = Permission::firstOrCreate([
            'name' => 'categories.view',
            'guard_name' => 'web',
        ]);

        $role = Role::firstOrCreate([
            'name' => 'Category Viewer',
            'guard_name' => 'web',
        ]);

        $role->givePermissionTo($permission);

        $user = User::factory()->create();
        $user->assignRole($role);

        Sanctum::actingAs($user);
    }

    public function test_viewer_can_load_active_category_types(): void
    {
        CategoryType::create([
            'name' => 'Item Category',
            'code' => 'ITEM_CATEGORY',
            'is_active' => true,
        ]);

        CategoryType::create([
            'name' => 'Item Condition',
            'code' => 'ITEM_CONDITION',
            'is_active' => true,
        ]);

        CategoryType::create([
            'name' => 'Inactive Type',
            'code' => 'INACTIVE_TYPE',
            'is_active' => false,
        ]);

        $this->loginAsCategoryViewer();

        $this->getJson('/api/category-types/options')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonFragment([
                'code' => 'ITEM_CATEGORY',
            ])
            ->assertJsonMissing([
                'code' => 'INACTIVE_TYPE',
            ]);
    }

    public function test_viewer_cannot_manage_category_types(): void
    {
        $this->loginAsCategoryViewer();

        $this->getJson('/api/category-types')
            ->assertForbidden();

        $this->postJson('/api/category-types', [
            'name' => 'Warranty Status',
            'code' => 'WARRANTY_STATUS',
        ])->assertForbidden();
    }

    public function test_user_without_permission_cannot_get_options(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $this->getJson('/api/category-types/options')
            ->assertForbidden();
    }

    public function test_guest_cannot_get_options(): void
    {
        $this->getJson('/api/category-types/options')
            ->assertUnauthorized();
    }
}
