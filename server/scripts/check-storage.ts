/**
 * Checks the S3 storage settings in server/.env against the real bucket:
 * upload, signed read, browser access (CORS), download name, privacy and delete.
 * Run with: npm run storage:check -w server
 * Prints no secrets or signed URLs.
 */
import { config } from '../src/config';
import { storage } from '../src/services/storage';

let failed = false;
const report = (status: 'ok' | 'FAIL' | 'WARN', message: string) => {
  if (status === 'FAIL') failed = true;
  console.log(`  ${status.padEnd(4)}  ${message}`);
};

function explain(error: unknown): string {
  const err = error as { name?: string; message?: string; code?: string; cause?: { code?: string } };
  const code = err.name ?? err.code ?? '';
  const hints: Record<string, string> = {
    InvalidAccessKeyId: 'The key ID is wrong, or it is the master key, which the S3 API rejects. Create a key for this bucket.',
    Unauthorized: 'The key ID or secret is wrong, or it is the master key, which the S3 API rejects.',
    SignatureDoesNotMatch: 'The secret is wrong, or S3_REGION does not match the endpoint. Leave S3_REGION empty to read it from the endpoint.',
    AccessDenied: 'The key is not allowed to use this bucket. Create a key limited to this bucket with Read and Write access.',
    NoSuchBucket: 'No bucket with that name. Check S3_BUCKET against the name on your Buckets page.',
  };
  if (hints[code]) return `${code}: ${hints[code]}`;
  if (err.cause?.code === 'ENOTFOUND' || err.code === 'ENOTFOUND') {
    return 'The endpoint address was not found. Copy the "Endpoint" shown on your bucket\'s page into S3_ENDPOINT.';
  }
  return `${code || 'Error'}: ${err.message ?? String(error)}`;
}

async function main() {
  if (storage.name !== 's3' || !config.s3) {
    console.log('Storage is set to local disk. Fill in S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY in server/.env, then run this again.');
    process.exit(1);
  }

  const { bucket, endpoint, region } = config.s3;
  const origin = config.clientOrigins[0];
  console.log(`Checking bucket "${bucket}" at ${endpoint} (region ${region})\n`);

  const key = `storage-check/${Date.now()}.txt`;
  try {
    await storage.put(key, Buffer.from('tracked-links storage check'), 'text/plain');
    report('ok', 'Uploaded a test file.');
  } catch (error) {
    report('FAIL', `Upload failed. ${explain(error)}`);
    return;
  }

  try {
    const { url } = await storage.signedUrl(key);
    const res = await fetch(url, { headers: { Origin: origin } });
    if (res.ok && (await res.text()) === 'tracked-links storage check') {
      report('ok', 'Read it back through a signed URL.');
    } else {
      report('FAIL', `Signed URL returned HTTP ${res.status}. Check that S3_REGION matches the endpoint, or leave it empty.`);
    }

    const allowed = res.headers.get('access-control-allow-origin');
    if (allowed === origin || allowed === '*') {
      report('ok', `Browsers on ${origin} may load files (CORS).`);
    } else {
      report('FAIL', `No CORS rule for ${origin}. The viewer cannot load PDFs until the bucket allows this origin (see README, "Setting up Backblaze B2").`);
    }

    const download = await storage.signedUrl(key, { downloadName: 'resume.pdf' });
    const dlRes = await fetch(download.url);
    await dlRes.arrayBuffer();
    const disposition = dlRes.headers.get('content-disposition') ?? '';
    if (dlRes.ok && disposition.startsWith('attachment') && disposition.includes('resume.pdf')) {
      report('ok', 'Download links keep the original file name.');
    } else {
      report('WARN', 'Download links do not set the file name. Downloads still work but get a generic name.');
    }

    const unsigned = await fetch(url.split('?')[0]!);
    await unsigned.arrayBuffer();
    if (unsigned.ok) {
      report('FAIL', 'The bucket is public: files load without a signed URL. Set the bucket to Private.');
    } else {
      report('ok', `The bucket is private (unsigned request got HTTP ${unsigned.status}).`);
    }
  } catch (error) {
    report('FAIL', explain(error));
  } finally {
    try {
      await storage.remove(key);
      report('ok', 'Deleted the test file.');
    } catch (error) {
      report('FAIL', `Could not delete the test file "${key}". ${explain(error)}`);
    }
  }
}

main()
  .then(() => {
    console.log(failed ? '\nSome checks failed. Fix the items marked FAIL and run this again.' : '\nStorage is ready.');
    process.exit(failed ? 1 : 0);
  })
  .catch((error) => {
    console.error(explain(error));
    process.exit(1);
  });
