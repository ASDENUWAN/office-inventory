<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;


class Item extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'category_id',
        'condition_category_id',
        'quantity',
        'description',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'integer',
        ];
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(
            Category::class,
            'category_id'
        );
    }

    public function condition(): BelongsTo
    {
        return $this->belongsTo(
            Category::class,
            'condition_category_id'
        );
    }

    // User who originally created this item
    public function creator(): BelongsTo
    {
        return $this->belongsTo(
            User::class,
            'created_by'
        );
    }

    // User who last updated this item
    public function updater(): BelongsTo
    {
        return $this->belongsTo(
            User::class,
            'updated_by'
        );
    }
}
