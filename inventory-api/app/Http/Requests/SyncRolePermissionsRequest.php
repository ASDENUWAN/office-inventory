<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SyncRolePermissionsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'permissions' => [
                'present',
                'array',
                'max:100',
            ],

            'permissions.*' => [
                'required',
                'string',
                'distinct',

                Rule::exists('permissions', 'name')
                    ->where('guard_name', 'web'),
            ],
        ];
    }
}
