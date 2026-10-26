<?php

namespace App\Http\Controllers;

use App\Models\Certificate;
use App\Models\LevelTestAttempt;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Certificates: the learner's own list, and the public page each QR
 * points at.
 *
 * The public page shows only what the certificate says — name, level,
 * score, date, code — never the email or anything else of the account:
 * it is meant to be handed to an employer.
 */
class CertificateController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $request->user();
        $this->issueMissing($user->id);

        return Inertia::render('Certificates/Index', [
            'certificates' => Certificate::where('user_id', $user->id)
                ->orderBy('issued_at')->get()
                ->map(fn (Certificate $c) => $c->toClientArray(true)),
        ]);
    }

    public function show(Request $request, string $code): Response
    {
        $cert = Certificate::where('code', strtoupper($code))->firstOrFail();

        return Inertia::render('Certificates/Show', [
            'certificate' => $cert->toClientArray($request->user()?->id === $cert->user_id),
            'qr'          => $cert->qrSvg(),
        ]);
    }

    /** The name on it — the learner's to set, since the account name is often a first name */
    public function rename(Request $request, string $code): JsonResponse
    {
        $cert = Certificate::where('code', strtoupper($code))->firstOrFail();
        abort_unless($cert->user_id === $request->user()->id, 403);

        $data = $request->validate(['name' => ['required', 'string', 'min:2', 'max:120']]);
        $cert->update(['name' => trim($data['name'])]);

        return response()->json(['name' => $cert->name]);
    }

    /** Passed before certificates existed: issue them now, once */
    public function issueMissing(int $userId): void
    {
        LevelTestAttempt::with('test', 'user')
            ->where('user_id', $userId)->where('passed', true)->whereNotNull('submitted_at')
            ->orderBy('id')->get()
            ->each(fn ($a) => Certificate::issueFor($a));
    }
}
