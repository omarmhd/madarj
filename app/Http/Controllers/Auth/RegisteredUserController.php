<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\ProgressService;
use App\Support\Countries;
use Illuminate\Auth\Events\Registered;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Registration.
 *
 * ── Five questions, and two of them are not questions ──────
 * This screen once asked ten things. It now asks five, because a
 * long form on the way into a 168-day course loses the people the
 * course was built for.
 *
 * Two of the five are load-bearing — day one cannot open without
 * them, and neither can be a silent default:
 *
 *   `country` — infers the timezone. The timezone decides when a
 *               day rolls over and therefore whether a streak
 *               survives the night. Asking a beginner to pick an
 *               IANA identifier out of six hundred is how you lose
 *               them on the first screen; asking for a country is
 *               one tap.
 *   `track`   — one hour a day or two. This doubles every duration
 *               across all 168 days, so guessing it wrong makes
 *               every plan on every screen wrong.
 *
 * The other three are the name, the email, and the WhatsApp
 * number — the channel that reaches an Arabic-speaking learner
 * when email does not.
 *
 * Everything else that used to be here — nationality, age, goal,
 * how they heard about us — is gone from this screen. Those
 * columns are still there, unasked: the profile screen is the
 * right place for them, after the learner has committed.
 */
class RegisteredUserController extends Controller
{
    /**
     * Registration.
     *
     * The country list is sent from here rather than restated in
     * TypeScript, so the dropdown and the validation rule read from
     * one array and cannot drift apart — and drift shows up as a
     * rejected form the user has no way to fix.
     */
    public function create(): Response
    {
        return Inertia::render('Auth/Register', [
            'countries' => Countries::forSelect(),
        ]);
    }

    /**
     * Create the account, enrol, and sign in — one request.
     *
     * @throws ValidationException
     */
    public function store(Request $request, ProgressService $progress): RedirectResponse
    {
        $data = $request->validate([
            'name'     => ['required', 'string', 'max:120'],
            'email'    => ['required', 'string', 'lowercase', 'email', 'max:191', 'unique:'.User::class],
            'password' => ['required', 'confirmed', Rules\Password::defaults()],

            /**
             * A permissive phone rule on purpose.
             *
             * Learners write +20 10 1234 5678, 0020-10-1234-5678,
             * and the same digits in Arabic-Indic numerals — and a
             * strict pattern rejects a real number more often than it
             * catches a fake one. The shape is checked, the number is
             * not: it is a contact detail, not a credential.
             */
            'phone' => [
                'required', 'string', 'max:32',
                'regex:/^[\d\s\-\+\(\)\x{0660}-\x{0669}]{7,32}$/u',
            ],

            'country'  => ['required', Rule::in(Countries::codes())],
            'track'    => ['required', Rule::in(['A', 'B'])],
        ]);

        $user = User::create([
            'name'     => $data['name'],
            'email'    => $data['email'],
            'password' => Hash::make($data['password']),
            // Digits and a leading + only — the formatting was theirs,
            // and a stored number should be dialable, not decorated
            'phone'    => $this->normalisePhone($data['phone']),
            'country'  => $data['country'],
        ]);

        // Enrol in the same request: no second screen to abandon.
        // The timezone comes from the country, never from a question.
        $progress->enroll($user, $data['track'], Countries::timezone($data['country']));

        event(new Registered($user));

        Auth::login($user);

        return redirect(route('dashboard', absolute: false));
    }

    /**
     * A stored number should be dialable, not decorated.
     *
     * Arabic-Indic digits are folded to ASCII first — a learner
     * typing on an Arabic keyboard produces ٠٧٩… and storing those
     * makes the number unsearchable and unclickable. Then every
     * separator goes, and a leading `+` is the only symbol kept.
     */
    protected function normalisePhone(string $raw): string
    {
        $ascii = strtr($raw, [
            '٠' => '0', '١' => '1', '٢' => '2', '٣' => '3', '٤' => '4',
            '٥' => '5', '٦' => '6', '٧' => '7', '٨' => '8', '٩' => '9',
        ]);

        $plus = str_starts_with(trim($ascii), '+') ? '+' : '';

        return $plus.preg_replace('/\D/', '', $ascii);
    }
}
