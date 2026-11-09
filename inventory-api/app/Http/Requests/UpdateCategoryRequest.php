<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateCategoryRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        // Get the category from route model binding.
        $category = $this->route('category');

        return [
            'name' => [
                'sometimes',
                'required',
                'string',
                'max:100',

                Rule::unique('categories', 'name')
                    ->where(
                        'category_type_id',
                        $category->category_type_id
                    )
                    ->ignore($category),
            ],

            'category_type_id' => [
                'prohibited',
            ],

            'description' => [
                'sometimes',
                'nullable',
                'string',
            ],

            'is_active' => [
                'sometimes',
                'required',
                'boolean',
            ],
        ];
    }
}
