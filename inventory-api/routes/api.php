<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\CategoryTypeController;

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
