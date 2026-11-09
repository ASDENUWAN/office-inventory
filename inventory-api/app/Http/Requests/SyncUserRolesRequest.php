<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SyncUserRolesRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'roles' => [
                'present',
                'array',
                'max:20',
            ],

            'roles.*' => [
                'required',
                'integer',
                'distinct',

                Rule::exists('roles', 'id')
                    ->where('guard_name', 'web'),
            ],
        ];
    }
}
