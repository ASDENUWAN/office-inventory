<?php

namespace App\Http\Requests;

use App\Models\CategoryType;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateItemRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $itemTypeId = CategoryType::where(
            'code',
            'ITEM_CATEGORY'
        )
            ->where('is_active', true)
            ->value('id');

        $conditionTypeId = CategoryType::where(
            'code',
            'ITEM_CONDITION'
        )
            ->where('is_active', true)
            ->value('id');

        return [
            'name' => [
                'sometimes',
                'required',
                'string',
                'max:150',
            ],

            'category_id' => [
                'sometimes',
                'required',
                'integer',

                Rule::exists('categories', 'id')
                    ->where('category_type_id', $itemTypeId)
                    ->where('is_active', true),
            ],

            'condition_category_id' => [
                'sometimes',
                'required',
                'integer',

                Rule::exists('categories', 'id')
                    ->where('category_type_id', $conditionTypeId)
                    ->where('is_active', true),
            ],

            'description' => [
                'sometimes',
                'nullable',
                'string',
            ],

            // Quantity must use its own API endpoint.
            'quantity' => ['missing'],

            // Prevent user tracking manipulation.
            'created_by' => ['missing'],
            'updated_by' => ['missing'],
        ];
    }
}
