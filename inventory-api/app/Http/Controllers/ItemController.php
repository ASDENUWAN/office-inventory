<?php

namespace App\Http\Controllers;

use App\Models\Item;
use App\Http\Requests\StoreItemRequest;
use App\Http\Requests\UpdateItemRequest;
use App\Http\Requests\AdjustItemQuantityRequest;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class ItemController extends Controller
{
    // Relationships included in API responses.
    private const RELATIONS = [
        'category:id,name,category_type_id',
        'condition:id,name,category_type_id',
        'creator:id,name',
        'updater:id,name',
    ];

    // GET /api/items
    public function index(): JsonResponse
    {
        $items = Item::with(self::RELATIONS)
            ->orderByDesc('id')
            ->paginate(10);

        return response()->json([
            'data' => $items->items(),

            'meta' => [
                'current_page' => $items->currentPage(),
                'last_page' => $items->lastPage(),
                'per_page' => $items->perPage(),
                'total' => $items->total(),
            ],
        ]);
    }

    // POST /api/items
    public function store(
        StoreItemRequest $request
    ): JsonResponse {

        $data = $request->validated();

        $quantity = $data['quantity'] ?? 0;

        // Creating stock above zero requires extra permission.
        if (
            $quantity > 0 &&
            !$request->user()->can('items.adjust-quantity')
        ) {
            return response()->json([
                'message' => 'You do not have permission to set stock quantity.',
            ], 403);
        }

        $item = new Item($data);

        $item->quantity = $quantity;

        // Always use the authenticated user.
        $item->created_by = $request->user()->id;

        $item->save();

        return response()->json([
            'message' => 'Item created successfully.',
            'data' => $item->load(self::RELATIONS),
        ], 201);
    }

    // GET /api/items/{item}
    public function show(Item $item): JsonResponse
    {
        return response()->json([
            'data' => $item->load(self::RELATIONS),
        ]);
    }

    // PUT/PATCH /api/items/{item}
    public function update(
        UpdateItemRequest $request,
        Item $item
    ): JsonResponse {

        $item->fill($request->validated());

        // Record the user who performed this update.
        $item->updated_by = $request->user()->id;

        $item->save();

        return response()->json([
            'message' => 'Item updated successfully.',
            'data' => $item->load(self::RELATIONS),
        ]);
    }

    // PATCH /api/items/{item}/quantity
    public function adjustQuantity(
        AdjustItemQuantityRequest $request,
        Item $item
    ): JsonResponse {

        $data = $request->validated();

        $item->quantity = $data['quantity'];

        $item->updated_by = $request->user()->id;

        $item->save();

        return response()->json([
            'message' => 'Item quantity updated successfully.',
            'data' => $item->load(self::RELATIONS),
        ]);
    }

    // DELETE /api/items/{item}
    public function destroy(Item $item): JsonResponse
    {
        $item->delete();

        return response()->json(null, 204);
    }
}
