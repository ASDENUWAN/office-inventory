<?php

namespace App\Http\Requests;

use App\Models\CategoryType;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreItemRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        // Find the active Item Category type.
        $itemTypeId = CategoryType::where(
            'code',
            'ITEM_CATEGORY'
        )
            ->where('is_active', true)
            ->value('id');

        // Find the active Item Condition type.
        $conditionTypeId = CategoryType::where(
            'code',
            'ITEM_CONDITION'
        )
            ->where('is_active', true)
            ->value('id');

        return [
            'name' => [
                'required',
                'string',
                'max:150',
            ],

            'category_id' => [
                'required',
                'integer',

                Rule::exists('categories', 'id')
                    ->where('category_type_id', $itemTypeId)
                    ->where('is_active', true),
            ],

            'condition_category_id' => [
                'required',
                'integer',

                Rule::exists('categories', 'id')
                    ->where('category_type_id', $conditionTypeId)
                    ->where('is_active', true),
            ],

            'quantity' => [
                'sometimes',
                'required',
                'integer',
                'min:0',
            ],

            'description' => [
                'nullable',
                'string',
            ],

            // Users cannot submit tracking IDs.
            'created_by' => ['missing'],
            'updated_by' => ['missing'],
        ];
    }
}
