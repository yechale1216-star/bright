/**
 * @brightpath/api-client
 * Shared HTTP API client and network utilities
 */

export { getApiUrl, API_URL, SOCKET_URL, APP_URL, apiUrl, socketUrl, appUrl } from "../config";
export {
  fetchWithTimeout,
  apiFetch,
  RequestError,
  type FetchOptions,
} from "../../lib/utils/fetch-with-timeout";
