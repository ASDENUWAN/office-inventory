<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Item extends Model
{
    use HasFactory;

    protected $table = 'items';

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

    // Item belongs to an Item Category
    public function category(): BelongsTo
    {
        return $this->belongsTo(
            Category::class,
            'category_id'
        );
    }

    // Item belongs to a Condition Category
    public function condition(): BelongsTo
    {
        return $this->belongsTo(
            Category::class,
            'condition_category_id'
        );
    }
}
