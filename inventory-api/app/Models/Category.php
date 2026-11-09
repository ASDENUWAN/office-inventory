<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Category extends Model
{
    use HasFactory;

    protected $table = 'categories';

    protected $fillable = [
        'category_type_id',
        'name',
        'description',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
        ];
    }

    // Each category belongs to one category type.
    public function categoryType(): BelongsTo
    {
        return $this->belongsTo(
            CategoryType::class,
            'category_type_id'
        );
    }

    // Items using this category as their item category.
    public function items(): HasMany
    {
        return $this->hasMany(
            Item::class,
            'category_id'
        );
    }

    // Items using this category as their condition.
    public function conditionItems(): HasMany
    {
        return $this->hasMany(
            Item::class,
            'condition_category_id'
        );
    }
}
