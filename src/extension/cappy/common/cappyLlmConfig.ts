/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Default provider base URL used by Cappy compatibility layer.
 */
export const DEFAULT_CAPPY_PROVIDER_BASE_URL = 'https://api.openai.com/v1';

/**
 * Default provider model used by Cappy compatibility layer.
 */
export const DEFAULT_CAPPY_PROVIDER_MODEL = 'gpt-4o-mini';

/**
 * Default provider backend used by Cappy compatibility layer.
 */
export const DEFAULT_CAPPY_PROVIDER_BACKEND = 'openai' as const;

/**
 * Secret key for provider API key storage.
 */
export const CAPPY_PROVIDER_API_KEY_SECRET = 'cappy.provider.apiKey';
