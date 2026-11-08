<?php

namespace App\Providers;

use App\Models\User;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        Gate::before(function (User $user, string $ability) {

            // Super Admin automatically passes permission checks.
            if ($user->hasRole('Super Admin')) {
                return true;
            }

            // All other users use normal permission checking.
            return null;
        });
    }
}
