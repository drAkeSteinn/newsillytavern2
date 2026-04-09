import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/embeddings/upload - Upload file and extract text
 * Returns the text content for preview before chunking
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = [
      'text/plain',
      'text/markdown',
      'text/html',
      'application/json',
      'text/csv',
      'application/pdf',
      'text/x-python',
      'text/x-javascript',
      'text/x-typescript',
      'text/x-java',
      'text/x-c',
      'text/x-c++',
      'text/x-ruby',
      'text/x-go',
      'text/x-rust',
      'text/xml',
      'application/xml',
    ];

    const fileName = file.name.toLowerCase();
    const isAllowedExtension = /\.(txt|md|json|csv|py|js|ts|jsx|tsx|java|c|cpp|rb|go|rs|xml|html|htm|log|yaml|yml|toml|ini|cfg)$/i.test(fileName);

    if (!isAllowedExtension && !allowedTypes.includes(file.type)) {
      return NextResponse.json({
        error: 'Unsupported file type. Use .txt, .md, .json, .csv, code files, etc.',
      }, { status: 400 });
    }

    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large. Maximum 10MB.' }, { status: 400 });
    }

    const text = await file.text();

    // Basic HTML stripping for HTML files
    let content = text;
    if (fileName.endsWith('.html') || fileName.endsWith('.htm')) {
      content = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    }

    return NextResponse.json({
      success: true,
      data: {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type || detectFileType(fileName),
        content,
        characterCount: content.length,
      },
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message || 'Error processing file',
    }, { status: 500 });
  }
}

function detectFileType(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase();
  const typeMap: Record<string, string> = {
    txt: 'text/plain',
    md: 'text/markdown',
    json: 'application/json',
    csv: 'text/csv',
    html: 'text/html',
    htm: 'text/html',
    py: 'text/x-python',
    js: 'text/x-javascript',
    ts: 'text/x-typescript',
    jsx: 'text/x-javascript',
    tsx: 'text/x-typescript',
    java: 'text/x-java',
    c: 'text/x-c',
    cpp: 'text/x-c++',
    rb: 'text/x-ruby',
    go: 'text/x-go',
    rs: 'text/x-rust',
    xml: 'text/xml',
    yaml: 'text/yaml',
    yml: 'text/yaml',
  };
  return typeMap[ext || ''] || 'text/plain';
}
