<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

use App\Http\Controllers\AuthController;

use App\Http\Controllers\RoleController;
use App\Http\Controllers\PermissionController;

use App\Http\Controllers\UserController;

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



Route::middleware('auth:sanctum')->group(function () {

    // ==========================
    // ROLE MANAGEMENT
    // ==========================

    Route::get('/roles', [
        RoleController::class,
        'index'
    ])->middleware('can:roles.view');

    Route::post('/roles', [
        RoleController::class,
        'store'
    ])->middleware('can:roles.create');

    Route::get('/roles/{role}', [
        RoleController::class,
        'show'
    ])->middleware('can:roles.view');

    Route::put('/roles/{role}', [
        RoleController::class,
        'update'
    ])->middleware('can:roles.update');

    Route::patch('/roles/{role}', [
        RoleController::class,
        'update'
    ])->middleware('can:roles.update');

    Route::delete('/roles/{role}', [
        RoleController::class,
        'destroy'
    ])->middleware('can:roles.delete');

    // Assign or revoke permissions on a role.
    Route::put('/roles/{role}/permissions', [
        RoleController::class,
        'syncPermissions'
    ])->middleware([
        'can:roles.update',
        'can:permissions.assign',
    ]);

    // ==========================
    // PERMISSION MANAGEMENT
    // ==========================

    Route::get('/permissions', [
        PermissionController::class,
        'index'
    ])->middleware('can:permissions.view');

    Route::post('/permissions', [
        PermissionController::class,
        'store'
    ])->middleware('can:permissions.create');

    Route::get('/permissions/{permission}', [
        PermissionController::class,
        'show'
    ])->middleware('can:permissions.view');

    Route::delete('/permissions/{permission}', [
        PermissionController::class,
        'destroy'
    ])->middleware('can:permissions.delete');
});


Route::get(
    '/users/assignable-roles',
    [UserController::class, 'assignableRoles']
)->middleware('can:users.assign-roles');


Route::middleware('auth:sanctum')->group(function () {

    // Get all users
    Route::get('/users', [
        UserController::class,
        'index'
    ])->middleware('can:users.view');

    // Create a user
    Route::post('/users', [
        UserController::class,
        'store'
    ])->middleware('can:users.create');

    // Get one user
    Route::get('/users/{user}', [
        UserController::class,
        'show'
    ])->middleware('can:users.view');

    // Update user profile
    Route::put('/users/{user}', [
        UserController::class,
        'update'
    ])->middleware('can:users.update');

    Route::patch('/users/{user}', [
        UserController::class,
        'update'
    ])->middleware('can:users.update');

    // Assign or remove user roles
    Route::put('/users/{user}/roles', [
        UserController::class,
        'syncRoles'
    ])->middleware('can:users.assign-roles');
});

Route::get(
    '/category-types/options',
    [CategoryTypeController::class, 'options']
)->middleware([
    'auth:sanctum',
    'can:categories.view',
]);

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



Route::get(
    '/items/form-options',
    [ItemController::class, 'formOptions']
)->middleware('can:items.view');

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
