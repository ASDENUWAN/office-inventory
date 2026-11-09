<?php

namespace App\Http\Controllers;

use App\Models\Category;
use App\Http\Requests\StoreCategoryRequest;
use App\Http\Requests\UpdateCategoryRequest;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class CategoryController extends Controller
{
    // GET /api/categories
    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'type' => ['sometimes', 'string', 'max:100'],
            'active_only' => ['sometimes', 'boolean'],
        ]);

        $query = Category::with('categoryType');

        // Filter categories by category type code.
        if ($request->filled('type')) {
            $query->whereHas('categoryType', function ($q) use ($request) {
                $q->where('code', $request->query('type'));
            });
        }

        // Only include active categories from active types.
        if ($request->boolean('active_only')) {
            $query->where('is_active', true)
                ->whereHas('categoryType', function ($q) {
                    $q->where('is_active', true);
                });
        }

        return response()->json([
            'data' => $query->orderBy('name')->get(),
        ]);
    }

    // POST /api/categories
    public function store(
        StoreCategoryRequest $request
    ): JsonResponse {

        $category = Category::create(
            $request->validated()
        );

        return response()->json([
            'message' => 'Category created successfully.',
            'data' => $category->load('categoryType'),
        ], 201);
    }

    // GET /api/categories/{category}
    public function show(Category $category): JsonResponse
    {
        return response()->json([
            'data' => $category->load('categoryType'),
        ]);
    }

    // PUT/PATCH /api/categories/{category}
    public function update(
        UpdateCategoryRequest $request,
        Category $category
    ): JsonResponse {

        $category->update($request->validated());

        return response()->json([
            'message' => 'Category updated successfully.',
            'data' => $category->fresh()->load('categoryType'),
        ]);
    }

    // DELETE /api/categories/{category}
    public function destroy(Category $category): JsonResponse
    {
        // Prevent deleting categories already used by items.
        if (
            $category->items()->exists() ||
            $category->conditionItems()->exists()
        ) {
            return response()->json([
                'message' => 'Cannot delete a category used by inventory items.',
            ], 409);
        }

        $category->delete();

        return response()->json(null, 204);
    }
}
