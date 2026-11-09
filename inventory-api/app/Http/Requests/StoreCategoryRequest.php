<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreCategoryRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'category_type_id' => [
                'required',
                'integer',

                Rule::exists(
                    'category_types',
                    'id'
                )->where('is_active', true),
            ],

            'name' => [
                'required',
                'string',
                'max:100',

                Rule::unique('categories', 'name')
                    ->where(
                        'category_type_id',
                        $this->integer('category_type_id')
                    ),
            ],

            'description' => [
                'nullable',
                'string',
            ],

            'is_active' => [
                'sometimes',
                'boolean',
            ],
        ];
    }
}
