<?php

namespace App\Http\Controllers;

use App\Models\CategoryType;
use App\Http\Requests\StoreCategoryTypeRequest;
use App\Http\Requests\UpdateCategoryTypeRequest;
use Illuminate\Http\JsonResponse;

class CategoryTypeController extends Controller
{
    // GET /api/category-types
    public function index(): JsonResponse
    {
        $categoryTypes = CategoryType::orderBy('id')->get();

        return response()->json([
            'data' => $categoryTypes,
        ]);
    }

    // POST /api/category-types
    public function store(
        StoreCategoryTypeRequest $request
    ): JsonResponse {

        $categoryType = CategoryType::create(
            $request->validated()
        );

        return response()->json([
            'message' => 'Category type created successfully.',
            'data' => $categoryType,
        ], 201);
    }

    // GET /api/category-types/{categoryType}
    public function show(
        CategoryType $categoryType
    ): JsonResponse {

        return response()->json([
            'data' => $categoryType,
        ]);
    }

    // PUT/PATCH /api/category-types/{categoryType}
    public function update(
        UpdateCategoryTypeRequest $request,
        CategoryType $categoryType
    ): JsonResponse {

        $data = $request->validated();

        // Protect essential inventory category types.
        $protectedCodes = [
            'ITEM_CATEGORY',
            'ITEM_CONDITION',
        ];

        if (
            in_array($categoryType->code, $protectedCodes, true)
            && array_key_exists('is_active', $data)
            && !$data['is_active']
        ) {
            return response()->json([
                'message' => 'This system category type cannot be deactivated.',
            ], 422);
        }

        $categoryType->update($data);

        return response()->json([
            'message' => 'Category type updated successfully.',
            'data' => $categoryType->fresh(),
        ]);
    }

    // DELETE /api/category-types/{categoryType}
    public function destroy(
        CategoryType $categoryType
    ): JsonResponse {

        // Don't delete category types required by the system.
        if (in_array($categoryType->code, [
            'ITEM_CATEGORY',
            'ITEM_CONDITION',
        ], true)) {
            return response()->json([
                'message' => 'System category types cannot be deleted.',
            ], 403);
        }

        // Prevent deletion when categories reference this type.
        if ($categoryType->categories()->exists()) {
            return response()->json([
                'message' => 'Cannot delete a category type that contains categories.',
            ], 409);
        }

        $categoryType->delete();

        return response()->json(null, 204);
    }


    /**
     * GET /api/category-types/options
     *
     * Return active category types for dropdowns.
     */
    public function options(): JsonResponse
    {
        $categoryTypes = CategoryType::query()
            ->where('is_active', true)
            ->orderBy('name')
            ->get([
                'id',
                'name',
                'code',
            ]);

        return response()->json([
            'data' => $categoryTypes,
        ]);
    }
}
