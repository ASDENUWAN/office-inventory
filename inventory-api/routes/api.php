<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\CategoryTypeController;
use App\Http\Controllers\CategoryController;
use App\Http\Controllers\ItemController;

Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware('auth:sanctum');


// Public login route
Route::post('/login', [
    AuthController::class,
    'login'
])->middleware('throttle:5,1');


// Protected authentication routes
Route::middleware('auth:sanctum')->group(function () {

    // Get currently authenticated user
    Route::get('/me', [
        AuthController::class,
        'me'
    ]);

    // Logout authenticated user
    Route::post('/logout', [
        AuthController::class,
        'logout'
    ]);
});


Route::middleware([
    'auth:sanctum',
    'can:category-types.manage',
])->group(function () {

    Route::get(
        '/category-types',
        [CategoryTypeController::class, 'index']
    );

    Route::post(
        '/category-types',
        [CategoryTypeController::class, 'store']
    );

    Route::get(
        '/category-types/{categoryType}',
        [CategoryTypeController::class, 'show']
    );

    Route::put(
        '/category-types/{categoryType}',
        [CategoryTypeController::class, 'update']
    );

    Route::patch(
        '/category-types/{categoryType}',
        [CategoryTypeController::class, 'update']
    );

    Route::delete(
        '/category-types/{categoryType}',
        [CategoryTypeController::class, 'destroy']
    );
});


Route::middleware('auth:sanctum')->group(function () {

    // View all categories
    Route::get(
        '/categories',
        [CategoryController::class, 'index']
    )->middleware('can:categories.view');

    // Create category
    Route::post(
        '/categories',
        [CategoryController::class, 'store']
    )->middleware('can:categories.create');

    // View single category
    Route::get(
        '/categories/{category}',
        [CategoryController::class, 'show']
    )->middleware('can:categories.view');

    // Update category
    Route::put(
        '/categories/{category}',
        [CategoryController::class, 'update']
    )->middleware('can:categories.update');

    Route::patch(
        '/categories/{category}',
        [CategoryController::class, 'update']
    )->middleware('can:categories.update');

    // Delete category
    Route::delete(
        '/categories/{category}',
        [CategoryController::class, 'destroy']
    )->middleware('can:categories.delete');
});



Route::middleware('auth:sanctum')->group(function () {

    // View all items
    Route::get(
        '/items',
        [ItemController::class, 'index']
    )->middleware('can:items.view');

    // Create an item
    Route::post(
        '/items',
        [ItemController::class, 'store']
    )->middleware('can:items.create');

    // View one item
    Route::get(
        '/items/{item}',
        [ItemController::class, 'show']
    )->middleware('can:items.view');

    // Update item details
    Route::put(
        '/items/{item}',
        [ItemController::class, 'update']
    )->middleware('can:items.update');

    Route::patch(
        '/items/{item}',
        [ItemController::class, 'update']
    )->middleware('can:items.update');

    // Adjust item quantity
    Route::patch(
        '/items/{item}/quantity',
        [ItemController::class, 'adjustQuantity']
    )->middleware('can:items.adjust-quantity');

    // Delete an item
    Route::delete(
        '/items/{item}',
        [ItemController::class, 'destroy']
    )->middleware('can:items.delete');
});
