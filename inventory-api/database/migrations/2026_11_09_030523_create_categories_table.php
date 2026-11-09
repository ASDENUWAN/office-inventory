
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('categories', function (Blueprint $table) {

            $table->id();

            $table->foreignId('category_type_id')
                ->constrained('category_types')
                ->restrictOnDelete();

            $table->string('name', 100);

            $table->text('description')->nullable();

            $table->boolean('is_active')->default(true);

            $table->timestamps();

            $table->unique([
                'category_type_id',
                'name',
            ]);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('categories');
    }
};
