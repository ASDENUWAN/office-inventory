<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Spatie\Permission\Models\Role;

class CreateSuperAdmin extends Command
{
    protected $signature = 'app:create-super-admin';

    protected $description = 'Create the initial Super Admin user';

    public function handle(): int
    {
        // 1. Check whether the Super Admin role exists.
        $roleExists = Role::where('name', 'Super Admin')
            ->where('guard_name', 'web')
            ->exists();

        if (!$roleExists) {
            $this->error('Super Admin role not found. Run the seeder first.');

            return self::FAILURE;
        }

        // 2. Prevent creating another initial Super Admin.
        if (User::role('Super Admin')->exists()) {
            $this->error('An initial Super Admin already exists.');

            return self::FAILURE;
        }

        // 3. Ask for user information.
        $name = trim((string) $this->ask('Enter full name'));

        $email = strtolower(trim(
            (string) $this->ask('Enter email address')
        ));

        $password = (string) $this->secret('Enter password');

        $confirmPassword = (string) $this->secret('Confirm password');

        // 4. Validate the provided information.
        if ($name === '') {
            $this->error('Name is required.');

            return self::FAILURE;
        }

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $this->error('Invalid email address.');

            return self::FAILURE;
        }

        if (User::where('email', $email)->exists()) {
            $this->error('This email is already registered.');

            return self::FAILURE;
        }

        if (strlen($password) < 4) {
            $this->error('Password must have at least 4 characters.');

            return self::FAILURE;
        }

        if ($password !== $confirmPassword) {
            $this->error('Passwords do not match.');

            return self::FAILURE;
        }

        // 5. Create user and assign the role.
        DB::transaction(function () use ($name, $email, $password) {

            $user = User::create([
                'name' => $name,
                'email' => $email,
                'password' => $password,
            ]);

            $user->assignRole('Super Admin');
        });

        $this->info('Super Admin created successfully!');

        return self::SUCCESS;
    }
}
