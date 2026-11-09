<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;
use Spatie\Permission\Models\Permission;

class AuthController extends Controller
{
    // POST /api/login
    public function login(Request $request): JsonResponse
    {
        // Step 1: Validate login information.
        $credentials = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        // Step 2: Check user credentials.
        if (!Auth::guard('web')->attempt($credentials)) {
            throw ValidationException::withMessages([
                'email' => ['Invalid email or password.'],
            ]);
        }

        // Step 3: Regenerate the session ID.
        $request->session()->regenerate();

        // Step 4: Get authenticated user.
        $user = $request->user('web');

        return response()->json([
            'message' => 'Login successful.',
            ...$this->userData($user),
        ]);
    }

    // GET /api/me
    public function me(Request $request): JsonResponse
    {
        $user = $request->user();

        return response()->json(
            $this->userData($user)
        );
    }

    // POST /api/logout
    public function logout(Request $request): JsonResponse
    {
        // Logout from the web session.
        Auth::guard('web')->logout();

        // Invalidate old session data.
        $request->session()->invalidate();

        // Generate a fresh CSRF token.
        $request->session()->regenerateToken();

        return response()->json([
            'message' => 'Logout successful.',
        ]);
    }

    // Prepare user data for React.
    private function userData(User $user): array
    {
        $isSuperAdmin = $user->hasRole('Super Admin');

        // Super Admin has every registered permission.
        if ($isSuperAdmin) {
            $permissions = Permission::query()
                ->where('guard_name', 'web')
                ->orderBy('name')
                ->pluck('name')
                ->all();
        } else {
            // Direct and role-inherited permissions.
            $permissions = $user->getAllPermissions()
                ->pluck('name')
                ->unique()
                ->sort()
                ->values()
                ->all();
        }

        return [
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
            ],

            'roles' => $user->getRoleNames()
                ->values()
                ->all(),

            'permissions' => $permissions,

            'is_super_admin' => $isSuperAdmin,
        ];
    }
}
