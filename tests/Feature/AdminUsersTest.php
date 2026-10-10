<?php

namespace Tests\Feature;

use App\Filament\Resources\Users\Pages\CreateUser;
use App\Filament\Resources\Users\Pages\EditUser;
use App\Filament\Resources\Users\Pages\ListUsers;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Livewire\Livewire;
use Tests\TestCase;

class AdminUsersTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::factory()->create(['is_admin' => true]);
        $this->actingAs($this->admin);
    }

    public function test_pages_render(): void
    {
        $learner = User::factory()->create(['country' => 'EG']);

        $this->get('/admin/users')->assertOk();
        $this->get('/admin/users/create')->assertOk();
        $this->get("/admin/users/{$learner->id}/edit")->assertOk();
    }

    public function test_admin_creates_a_learner_with_a_password(): void
    {
        Livewire::test(CreateUser::class)
            ->fillForm([
                'name'     => 'Sam',
                'email'    => 'sam@example.com',
                'country'  => 'SA',
                'password' => 'secret-pass-1',
            ])
            ->call('create')
            ->assertHasNoFormErrors();

        $user = User::where('email', 'sam@example.com')->firstOrFail();
        $this->assertSame('SA', $user->country);
        $this->assertTrue(Hash::check('secret-pass-1', $user->password));
    }

    public function test_editing_without_a_password_keeps_the_old_one(): void
    {
        $learner = User::factory()->create(['password' => 'old-pass-123']);

        Livewire::test(EditUser::class, ['record' => $learner->getRouteKey()])
            ->fillForm(['name' => 'Alex', 'country' => 'JO'])
            ->call('save')
            ->assertHasNoFormErrors();

        $learner->refresh();
        $this->assertSame('Alex', $learner->name);
        $this->assertSame('JO', $learner->country);
        $this->assertTrue(Hash::check('old-pass-123', $learner->password));
    }

    public function test_admin_resets_a_password(): void
    {
        $learner = User::factory()->create(['password' => 'old-pass-123']);

        Livewire::test(EditUser::class, ['record' => $learner->getRouteKey()])
            ->fillForm(['password' => 'new-pass-456'])
            ->call('save')
            ->assertHasNoFormErrors();

        $this->assertTrue(Hash::check('new-pass-456', $learner->refresh()->password));
    }

    public function test_access_fields_are_saved(): void
    {
        $learner = User::factory()->create();

        Livewire::test(EditUser::class, ['record' => $learner->getRouteKey()])
            ->fillForm(['is_admin' => true, 'free_weeks' => 4])
            ->call('save')
            ->assertHasNoFormErrors();

        $learner->refresh();
        $this->assertTrue($learner->is_admin);
        $this->assertSame(4, $learner->free_weeks);
    }

    public function test_country_filter_and_last_login_column(): void
    {
        $eg = User::factory()->create(['country' => 'EG']);
        $sa = User::factory()->create(['country' => 'SA', 'last_login_at' => now()->subDays(3)]);

        Livewire::test(ListUsers::class)
            ->assertTableColumnExists('last_login_at')
            ->assertSee('السعودية')
            ->filterTable('country', 'EG')
            ->assertCanSeeTableRecords([$eg])
            ->assertCanNotSeeTableRecords([$sa]);
    }

    public function test_logging_in_records_the_time(): void
    {
        $learner = User::factory()->create(['password' => 'pass-12345']);
        auth()->logout();

        $this->post('/login', ['email' => $learner->email, 'password' => 'pass-12345']);

        $this->assertNotNull($learner->refresh()->last_login_at);
    }
}
