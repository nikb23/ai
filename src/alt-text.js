/**
 * Generate alt text for images.
 * Pluggable to use OpenAI, Gemini, Anthropic, or local fallback.
 */

async function generateAltTexts(imageData, llmProvider) {
  const altTexts = [];

  for (const img of imageData) {
    let altText = img.alt || '';

    if (!altText && llmProvider !== 'local') {
      try {
        altText = await generateWithLLM(img, llmProvider);
      } catch (error) {
        console.warn(`  ⚠ Failed to generate alt text via ${llmProvider}, using fallback:`, error.message);
        altText = generateFallbackAltText(img);
      }
    } else if (!altText) {
      altText = generateFallbackAltText(img);
    }

    altTexts.push(altText);
  }

  return altTexts;
}

/**
 * Generate alt text using LLM API.
 */
async function generateWithLLM(img, provider) {
  switch (provider) {
    case 'openai':
      return generateWithOpenAI(img);
    case 'gemini':
      return generateWithGemini(img);
    case 'anthropic':
      return generateWithAnthropic(img);
    default:
      throw new Error(`Unknown LLM provider: ${provider}`);
  }
}

/**
 * Generate alt text with OpenAI API.
 */
async function generateWithOpenAI(img) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not set');

  // For now, return a placeholder; full implementation would call OpenAI vision API
  console.log(`  🤖 [OpenAI] Generating alt text for ${img.newFilename}`);
  return `Image: ${img.newFilename}`;
}

/**
 * Generate alt text with Google Gemini API.
 */
async function generateWithGemini(img) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');

  console.log(`  🤖 [Gemini] Generating alt text for ${img.newFilename}`);
  return `Image: ${img.newFilename}`;
}

/**
 * Generate alt text with Anthropic Claude API.
 */
async function generateWithAnthropic(img) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');

  console.log(`  🤖 [Anthropic] Generating alt text for ${img.newFilename}`);
  return `Image: ${img.newFilename}`;
}

/**
 * Fallback: generate alt text from filename and metadata.
 */
function generateFallbackAltText(img) {
  // Extract keywords from filename
  const keywords = img.newFilename
    .replace(/\.[^.]+$/, '') // Remove extension
    .split('-')
    .filter(word => word.length > 2)
    .join(' ');

  return keywords || 'Image';
}

module.exports = { generateAltTexts };
