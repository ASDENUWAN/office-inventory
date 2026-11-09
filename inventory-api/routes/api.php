<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\CategoryTypeController;
use App\Http\Controllers\CategoryController;

Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware('auth:sanctum');


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
