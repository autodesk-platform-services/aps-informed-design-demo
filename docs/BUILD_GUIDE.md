# Informed Design Demo - Complete Build Guide

This guide contains all the requirements and prompts needed to build this application from scratch in Cursor from an empty folder.

## Project Setup

### 1. Initial Project Structure
Create a Node.js backend service and React.js frontend application with the following structure:
- `backend/` - Express.js server
- `frontend/` - React.js application
- Backend runs on port 8080
- Frontend runs on port 3000

**Prompt:**
```
Create a full-stack application with a Node.js Express backend and React.js frontend. The backend should run on port 8080 and the frontend on port 3000. Set up the basic project structure with separate directories for backend and frontend.
```

### 2. Backend Dependencies
Install: `express`, `cors`, `dotenv`, `adm-zip`

**Prompt:**
```
Set up the backend package.json with Express.js server. Install dependencies: express, cors, dotenv, and adm-zip. Configure the server to use ES modules (type: "module" in package.json).
```

### 3. Frontend Dependencies
Install: `react`, `react-dom`, `react-scripts`, `xlsx`
Add proxy to `package.json`: `"proxy": "http://localhost:8080"`

**Prompt:**
```
Set up the frontend package.json with React.js. Install dependencies: react, react-dom, react-scripts, and xlsx. Add a proxy configuration to forward API requests to http://localhost:8080.
```

### 4. Environment Variables

**Backend `.env`:**
```
APS_CLIENT_ID=<your-client-id>
APS_CLIENT_SECRET=<your-client-secret>
APS_REDIRECT_URI=http://localhost:3000
PORT=8080
```

**Frontend `.env`:**
```
PORT=3000
REACT_APP_BACKEND_URL=http://localhost:8080
```

**Prompt:**
```
Create environment variable files for both backend and frontend. The backend needs APS_CLIENT_ID, APS_CLIENT_SECRET, APS_REDIRECT_URI, and PORT. The frontend needs PORT and REACT_APP_BACKEND_URL.
```

## Authentication

### 5. Implement 3-Legged OAuth Flow
- Use Autodesk Platform Services (APS) OAuth 2.0
- Authorization endpoint: `https://developer.api.autodesk.com/authentication/v2/authorize`
- Token endpoint: `https://developer.api.autodesk.com/authentication/v2/token`
- Required scopes: `data:read data:write data:create account:read`
- Store access token in `localStorage` as `aps_access_token`
- Use `state` parameter for OAuth security

**Prompt:**
```
Implement 3-legged OAuth authentication flow with Autodesk Platform Services. Create a login page that redirects users to Autodesk's authorization endpoint with required scopes (data:read data:write data:create account:read). Handle the OAuth callback, exchange the authorization code for an access token, and store it in localStorage as 'aps_access_token'. Use a state parameter for CSRF protection.
```

### 6. Backend Endpoints for Authentication
- `GET /api/aps/config` - Returns client ID and redirect URI
- `POST /api/aps/token` - Exchanges authorization code for access token

**Prompt:**
```
Create backend API endpoints for authentication: GET /api/aps/config to return client ID and redirect URI, and POST /api/aps/token to securely exchange the authorization code for an access token using the client secret (server-side only).
```

## UI/UX Requirements

### 7. Menu Bar
- Display user name and logout button
- Sticky positioning at top
- Autodesk brand colors (background: #ffffff, text: #1A1A1A)
- Logo and app title "Informed Design Demo" on the left

**Prompt:**
```
Create a sticky menu bar at the top of the page with Autodesk branding. Display the app title "Informed Design Demo" on the left with an Informed Design icon/logo. Show the user's name and a logout button on the right. Use Autodesk brand colors: white background (#ffffff) and dark text (#1A1A1A).
```

### 8. Branding
- App title: "Informed Design Demo"
- Use Informed Design icon as logo (SVG)
- Page background color: #F5F5F5
- Update HTML title tag to "Informed Design Demo"

**Prompt:**
```
Style the application with Autodesk branding. Set the page background to #F5F5F5. Update the HTML title tag to "Informed Design Demo". Add an Informed Design SVG icon/logo to the menu bar.
```

### 9. Account and Project Selectors
- Add dropdown selectors in the menu bar (side by side)
- Account selector: Label "Account", default text "Select Account"
- Project selector: Label "Project", default text "Select Project"
- Both selectors should fit in the menu bar

**Prompt:**
```
Add two dropdown selectors in the menu bar side by side: an Account selector with label "Account" and default text "Select Account", and a Project selector with label "Project" and default text "Select Project". Style them to fit nicely in the menu bar.
```

## Data Fetching

### 10. ACC Account Selection
- Endpoint: `GET https://developer.api.autodesk.com/project/v1/hubs`
- Add `x-ads-region: US` header to all APS API calls
- Filter for ACC accounts (type: "acc")
- Display account name in dropdown
- Save selected account ID to `localStorage` as `saved_account_id`
- Restore selection on page load

**Prompt:**
```
Implement ACC account selection. Fetch accounts from the APS API endpoint GET /project/v1/hubs with the x-ads-region: US header. Filter for ACC accounts (type: "acc") and display them in the Account dropdown. Save the selected account ID to localStorage as 'saved_account_id' and restore it on page load.
```

### 11. Project Selection
- Endpoint: `GET https://developer.api.autodesk.com/project/v1/hubs/{hubId}/projects`
- Use selected account (hub) to fetch projects
- Display project name in dropdown
- Save selected project ID to `localStorage` as `saved_project_id`
- Restore selection on page load
- Clear saved project when account changes

**Prompt:**
```
Implement project selection. When an account is selected, fetch projects from GET /project/v1/hubs/{hubId}/projects. Display project names in the Project dropdown. Save the selected project ID to localStorage as 'saved_project_id' and restore it on page load. Clear the saved project when the account changes.
```

### 12. Folder Selection
- Display folder tree on main page
- Only show contents of "Project Files" folder
- Endpoint: `GET https://developer.api.autodesk.com/data/v1/projects/{projectId}/folders`
- Recursively fetch nested folders within "Project Files"
- Use tree structure UI for selection
- Save selected folder URN to `localStorage` as `saved_folder_id`
- Restore selection on page load (including parent expansion)
- Clear saved folder when account or project changes

**Prompt:**
```
Implement folder selection with a tree structure. Fetch folders from GET /data/v1/projects/{projectId}/folders and only display contents of the "Project Files" folder. Recursively fetch nested folders. Create a tree UI where users can expand/collapse folders and select a folder. Save the selected folder URN to localStorage as 'saved_folder_id' and restore the selection (including expanded parent folders) on page load. Clear the saved folder when account or project changes.
```

## Product Display

### 13. Product Listing
- Endpoint: `GET https://developer.api.autodesk.com/industrialized-construction/informed-design/v1/products`
- Query parameters: `accessType=ACC&accessId={projectId}|{folderUrn}`
  - `accessType` should NOT be URL encoded
  - `accessId` should be URL encoded
  - Format: `{projectId}|{folderUrn}` (no URL encoding of the `|` delimiter)
- Remove "b." prefix from product IDs in responses
- Display products as clickable cards

**Prompt:**
```
Fetch products from the Informed Design API endpoint GET /industrialized-construction/informed-design/v1/products with query parameters accessType=ACC (not URL encoded) and accessId (URL encoded, format: {projectId}|{folderUrn}). Remove the "b." prefix from all product IDs in the response. Display products as clickable cards in a grid layout.
```

### 14. Product Card Display
Each product card should show:
- Product name (as heading)
- Thumbnail image (200px height, white background, below product name) - see section 15
- Release dropdown - see section 17
- Product state
- Release date (from selected release)

**Prompt:**
```
Create product cards that display: product name as a heading, a thumbnail image (200px height, white background) below the name, a release dropdown selector, product state, and release date from the selected release. Make cards expandable to show variants.
```

### 15. Product Thumbnails
- Use product download-url endpoint to get thumbnails
- Backend endpoint: `GET /api/informed-design/products/:productId/thumbnail?accessId={accessId}&accessType=ACC`
- Backend process:
  1. Fetch product to get default release ID
  2. Fetch release to extract objectKey from `thumbnails[0].thumbnail` property
  3. Call Informed Design API: `GET /products/{productId}/download-url?accessType=ACC&accessId={accessId}&objectKey={objectKey}`
  4. Download thumbnail from returned URL and stream to frontend
- Frontend: Call backend endpoint for each product's default release
- Display thumbnail with white background (200px height, object-fit: contain)
- Show loading placeholder with spinner while loading
- Process all products (thumbnails can load in parallel)

**Prompt:**
```
Implement product thumbnail display using the product download-url endpoint. Create a backend endpoint GET /api/informed-design/products/:productId/thumbnail that: (1) fetches the product to get the default release ID, (2) fetches the release to extract the objectKey from thumbnails[0].thumbnail property, (3) calls GET /products/{productId}/download-url with the objectKey as a query parameter, (4) downloads the thumbnail from the returned URL and streams it to the frontend. The frontend should call this backend endpoint for each product's default release. Display thumbnails with white background, 200px height, and object-fit: contain. Show a loading spinner placeholder while loading.
```

### 16. Product GLB Previews (Optional)
- GLB previews are optional for product cards
- If implemented, generate GLB preview for default release, first variant
- Process synchronously (one product at a time)
- Create GLB output for first variant
- Poll until status is SUCCESS
- Download GLB file
- Display using `<model-viewer>` component with:
  - `camera-controls` attribute
  - `auto-rotate` attribute
  - Height: 200px
- Show loading placeholder with spinner and "Loading 3D preview..." text
- Note: Product cards primarily use thumbnails (see section 15), GLB previews are optional

**Prompt:**
```
(Optional) Implement GLB 3D preview generation for products. For each product, generate a GLB output for the default release's first variant. Poll until status is SUCCESS, download the GLB file, and display it using the model-viewer web component with camera-controls and auto-rotate attributes at 200px height. Show a loading placeholder with spinner and "Loading 3D preview..." text. Note: Product cards primarily use thumbnails from the download-url endpoint, GLB previews are optional.
```

### 17. Release Selection
- Endpoint: `GET https://developer.api.autodesk.com/industrialized-construction/informed-design/v1/releases?productId={productId}&accessType=ACC&accessId={accessId}`
- Fetch ALL releases for each product (not just default)
- Display as dropdown in product card
- Show release number (e.g., "1", "2", "3")
- Mark default release with "(Default)" after number (e.g., "1 (Default)")
- Sort releases by number
- Initial selection: default release
- When release changes, update product's `defaultRelease` and refetch variants
- Style dropdown to match Autodesk style with proper sizing (width: auto, min-width: 120px, flex-shrink: 0)

**Prompt:**
```
Implement release selection dropdown in each product card. Fetch all releases for each product from GET /industrialized-construction/informed-design/v1/releases. Display release numbers in the dropdown, marking the default release with "(Default)" after the number. Sort releases by number. Initially select the default release. When the release changes, update the product's defaultRelease and refetch variants. Style the dropdown to match Autodesk style with proper sizing (width: auto, min-width: 120px, flex-shrink: 0) so it sizes to fit the text horizontally.
```

## Variant Display

### 18. Variant Listing
- Endpoint: `GET https://developer.api.autodesk.com/industrialized-construction/informed-design/v1/variants?releaseId={releaseId}&accessType=ACC&accessId={accessId}`
- Display variants when product card is expanded
- Show variant name (or variantName) if available, otherwise use "Variant {index}"
- Do NOT display variant ID
- If multiple variants have the same name, append numbers to differentiate (e.g., "Standard 1", "Standard 2", "Standard 3")
- Each variant card should be expandable
- Add "Add Variant" button with blue styling (#0696d7) in the variants header
- Add Import and Export buttons next to the "Add Variant" button, right-justified after the "Variants" title

**Prompt:**
```
Implement variant listing. When a product card is expanded, fetch variants from GET /industrialized-construction/informed-design/v1/variants. Display each variant as an expandable card showing only the variant name (or "Variant {index}" if no name). Do not display variant IDs. If multiple variants have the same name, append numbers to differentiate them (e.g., "Standard 1", "Standard 2", "Standard 3"). Add a "Variants" section header with an "Add Variant" button styled in blue (#0696d7). Add Import and Export buttons next to the "Add Variant" button, right-justified after the "Variants" title.
```

### 19. Variant Thumbnails
- Generate thumbnail for each variant in the list
- Process synchronously (one variant at a time)
- Create THUMBNAIL output for each variant
- Poll until status is SUCCESS
- Download and display thumbnail
- Display as 50px square image alongside variant name/ID
- Show loading placeholder with spinner (50px square) while generating
- Thumbnail should be positioned to the left of variant name/ID

**Prompt:**
```
Implement automatic thumbnail generation for variants. For each variant in the list, create a THUMBNAIL output, poll until status is SUCCESS, then download and display as a 50px square image positioned to the left of the variant name/ID. Show a 50px square loading spinner placeholder while generating. Process variants synchronously (one at a time).
```

### 20. Variant Details
When variant is expanded, show:
- Parameters section: Display all inputs from variant details
  - Endpoint: `GET https://developer.api.autodesk.com/industrialized-construction/informed-design/v1/variants/{variantId}?accessType=ACC&accessId={accessId}`
  - Show input name, value, type, description
- Preview section: Display GLB or thumbnail output
  - See section 21 for output generation

**Prompt:**
```
Implement variant details view. When a variant card is expanded, fetch variant details from GET /industrialized-construction/informed-design/v1/variants/{variantId}. Display a Parameters section showing all inputs with their name, value, type, and description. Display a Preview section for GLB or thumbnail outputs.
```

## Variant Management

### 21. Create Variant Form
- Fetch release inputs/parameters when "Add Variant" is clicked
- Endpoint: `GET https://developer.api.autodesk.com/industrialized-construction/informed-design/v1/releases/{releaseId}?accessType=ACC&accessId={accessId}`
- Display form with:
  - Variant name input field
  - Input fields for each parameter from release.inputs
  - Submit button
- Create variant endpoint: `POST /api/informed-design/variants?releaseId={releaseId}&accessId={accessId}&accessType=ACC`
- Request body: `{ name: string, inputs: [{ name: string, value: any }] }`
- Refresh variant list after creation

**Prompt:**
```
Implement a create variant form. When "Add Variant" is clicked, fetch the release details to get the input parameters. Display a form with a variant name input field and input fields for each parameter from the release. On submit, create the variant via POST /api/informed-design/variants with the variant name and parameter values. Refresh the variant list after successful creation.
```

### 22. Delete Variant
- Add delete button to each variant card
- Endpoint: `DELETE https://developer.api.autodesk.com/industrialized-construction/informed-design/v1/variants/{variantId}?accessType=ACC&accessId={accessId}`
- Confirm deletion with user
- Refresh variant list after deletion

**Prompt:**
```
Add a delete button to each variant card. When clicked, confirm deletion with the user, then call DELETE /industrialized-construction/informed-design/v1/variants/{variantId} to delete the variant. Refresh the variant list after successful deletion.
```

### 23. Export Variants
- Add export button (icon) next to "Add Variant" button
- Export all variants for the selected release to Excel/CSV
- Format: First column "Name", second column "ID", then one column per parameter name
- Each row represents one variant
- Use parameter names from the spreadsheet headers directly (don't check against release parameters)
- Prompt user to save the file
- Use xlsx library for Excel export

**Prompt:**
```
Implement variant export functionality. Add an export button (icon) next to the "Add Variant" button. When clicked, export all variants for the selected release to an Excel/CSV file. The format should be: first column "Name", second column "ID", then one column per parameter name. Each row represents one variant with its name, ID, and parameter values. Use the xlsx library for Excel export. Prompt the user to save the file.
```

### 24. Import Variants
- Add import button (icon) next to export button
- Accept .csv, .xlsx, .xls files
- Support drag-and-drop file upload
- Show file picker dialog with drag-and-drop zone
- Parse file and extract variant data (Name, ID, parameters)
- Skip ID column on import (don't use it for variant creation)
- Use parameter names directly from spreadsheet headers (don't check against release parameters)
- Don't use default values from release parameters
- Create a new variant for each row
- Show progress during import (current/total)
- Disable import button during import
- Refresh variant list for all releases after import
- Show success/failure count after import

**Prompt:**
```
Implement variant import functionality. Add an import button (icon) next to the export button. Support both file picker and drag-and-drop for .csv, .xlsx, and .xls files. Parse the file and extract variant data (Name, ID, parameters). Skip the ID column on import. Use parameter names directly from spreadsheet headers without checking against release parameters. Create a new variant for each row. Show import progress (current/total) and disable the button during import. Refresh the variant list for all releases after import completes. Show success/failure count in an alert.
```

### 25. Import/Export Button Styling
- Style import and export buttons to match "Add Variant" button
- Blue background (#0696d7), white text
- Icons should be larger (20px) and bolder (stroke-width: 2.5)
- Buttons should be 32px square
- Right-justify buttons after "Variants" title

**Prompt:**
```
Style the import and export buttons to match the "Add Variant" button. Use blue background (#0696d7), white text, 32px square buttons. Make the icons larger (20px) and bolder (stroke-width: 2.5). Right-justify the buttons after the "Variants" title.
```

## Output Generation and Display

### 26. Variant Output Generation
- Endpoint: `POST https://developer.api.autodesk.com/industrialized-construction/informed-design/v1/outputs`
- Query parameters: `accessType=ACC&accessId={accessId}` (NOT in body)
- Request body structure:
  ```json
  {
    "variantId": "<variantId>",
    "outputs": [
      {
        "type": "GLB" or "THUMBNAIL",
        "settings": {
          // Get from release.outputSettings[type]
          "representation": "[Primary]"  // Only for GLB/THUMBNAIL, NOT for PDF/DWG/IDW
        }
      }
    ]
  }
  ```
- For PDF output: Use `templatePath` (singular string, not array) instead of `templatePaths`
- Response contains `outputs` array with `outputId` and `status`
- Extract `outputId` from first item in `outputs` array

**Prompt:**
```
Implement variant output generation. Create a function that calls POST /industrialized-construction/informed-design/v1/outputs with query parameters accessType=ACC&accessId={accessId}. The request body should include variantId and an outputs array with type and settings (including representation for GLB/THUMBNAIL, but not for PDF/DWG/IDW). For PDF, use templatePath (singular) instead of templatePaths. Extract the outputId from the response.
```

### 27. Output Status Polling
- Endpoint: `GET https://developer.api.autodesk.com/industrialized-construction/informed-design/v1/outputs/{outputId}?accessType=ACC&accessId={accessId}`
- Poll every 1 second until status is `SUCCESS` or `FAILURE`
- Maximum 60 attempts (2 minutes)
- Update UI with status during polling

**Prompt:**
```
Implement output status polling. Poll GET /industrialized-construction/informed-design/v1/outputs/{outputId} every 1 second until status is SUCCESS or FAILURE, with a maximum of 60 attempts (2 minutes). Update the UI with the current status during polling.
```

### 28. Output Download
Two-step process:
1. **Get download request ID:**
   - Endpoint: `POST https://developer.api.autodesk.com/industrialized-construction/informed-design/v1/downloads`
   - Query parameters: `accessType=ACC&accessId={accessId}`
   - Request body: `{ "outputIds": [outputId] }` (plural, array)
   - Response contains `downloadRequestId`

2. **Get signed URL:**
   - Endpoint: `GET https://developer.api.autodesk.com/industrialized-construction/informed-design/v1/downloads/{downloadRequestId}?accessType=ACC&accessId={accessId}`
   - Response contains `outputs` array
   - Extract `url` from `outputs[0].url`
   - Backend downloads file from signed URL and streams to frontend
   - Frontend receives blob and creates object URL

**Prompt:**
```
Implement output download functionality using a two-step process: First, call POST /industrialized-construction/informed-design/v1/downloads with outputIds array to get a downloadRequestId. Then, call GET /industrialized-construction/informed-design/v1/downloads/{downloadRequestId} to get the signed URL. Have the backend download the file from the signed URL and stream it to the frontend. The frontend should receive a blob and create an object URL for display/download.
```

### 29. GLB Display
- Use `<model-viewer>` web component
- Include script: `<script type="module" src="https://unpkg.com/@google/model-viewer/dist/model-viewer.min.js"></script>`
- Attributes: `camera-controls`, `auto-rotate`
- Height: 200px
- Prevent card collapse when interacting with model-viewer (use `e.stopPropagation()`)

**Prompt:**
```
Implement GLB file display using the model-viewer web component. Include the model-viewer script from unpkg. Add camera-controls and auto-rotate attributes, set height to 200px. Prevent the card from collapsing when users interact with the model-viewer by stopping event propagation.
```

### 30. Downloads Section
Add "Downloads" section in expanded variant with:
- Output type dropdown: List all available output types from release
- Representation dropdown: Show only when output type is selected (hidden for PDF, DWG, IDW)
- Download button: 
  - Text: "Download" (or "View" for SVF)
  - Disabled until output is ready
  - Show status: "Generating...", "Downloading...", "Downloaded", "Failed - Try Again"
- Representation list: Filter by selected output type
- For PDF/DWG/IDW: Do not show representation selector, do not include `representation` in settings

**Prompt:**
```
Add a Downloads section to the expanded variant view. Include an output type dropdown listing all available output types from the release. Show a representation dropdown only when an output type is selected (hidden for PDF, DWG, IDW). Add a Download button that shows status ("Generating...", "Downloading...", "Downloaded", "Failed - Try Again") and is disabled until the output is ready. For PDF/DWG/IDW outputs, do not show the representation selector and do not include representation in the settings.
```

## Data Transformation

### 31. ID Prefix Removal
- Remove "b." prefix from all IDs in API responses:
  - Product IDs
  - Release IDs
  - Variant IDs
  - Output IDs
- Apply recursively to nested objects and arrays

**Prompt:**
```
Create a utility function to remove the "b." prefix from all IDs in API responses (product IDs, release IDs, variant IDs, output IDs). Apply this transformation recursively to nested objects and arrays. Use this function consistently throughout the application.
```

### 32. Access ID Format
- Format: `{projectId}|{folderUrn}`
- Remove "b." prefix from projectId before combining
- Do NOT URL encode the `|` delimiter
- Do NOT URL encode the folder URN
- Use for all Informed Design API calls

**Prompt:**
```
Format the accessId for Informed Design API calls as {projectId}|{folderUrn}. Remove the "b." prefix from projectId before combining. Do not URL encode the | delimiter or the folder URN. Use this format consistently for all Informed Design API calls.
```

## State Management

### 33. Persistence
Save to `localStorage`:
- `saved_account_id` - Selected ACC account
- `saved_project_id` - Selected project
- `saved_folder_id` - Selected folder URN

Restore on page load:
- Auto-select saved account, project, folder
- Trigger data fetching for saved selections
- Clear dependent saved values when parent selection changes

**Prompt:**
```
Implement localStorage persistence for user selections. Save selected account ID as 'saved_account_id', project ID as 'saved_project_id', and folder URN as 'saved_folder_id'. On page load, restore these selections and trigger data fetching. Clear dependent saved values when parent selections change (e.g., clear project when account changes).
```

### 34. Product Selection
- Only one product can be selected at a time
- Only one product card can be expanded at a time
- Do NOT persist product selection between sessions

**Prompt:**
```
Implement product selection state management. Ensure only one product can be selected and expanded at a time. Do not persist product selection between sessions (only account, project, and folder should be persisted).
```

## API Endpoints Summary

### Backend Endpoints

**Authentication:**
- `GET /api/aps/config` - Get APS configuration
- `POST /api/aps/token` - Exchange code for token

**ACC Data:**
- `GET /api/acc/accounts` - Get ACC accounts (hubs)
- `GET /api/acc/accounts/:hubId/projects` - Get projects for account
- `GET /api/acc/projects/:projectId/folders` - Get folders (recursive, Project Files only)

**Informed Design:**
- `GET /api/informed-design/products` - Get products (via project/folder params)
- `GET /api/informed-design/products/:productId/thumbnail` - Get product thumbnail (uses download-url endpoint)
- `GET /api/informed-design/releases` - Get all releases for product
- `GET /api/informed-design/releases/:releaseId` - Get release details
- `GET /api/informed-design/variants` - Get variants for release
- `GET /api/informed-design/variants/:variantId` - Get variant details
- `POST /api/informed-design/variants` - Create variant
- `DELETE /api/informed-design/variants/:variantId` - Delete variant
- `POST /api/informed-design/outputs` - Create output
- `GET /api/informed-design/outputs/:outputId` - Get output status
- `GET /api/informed-design/outputs/:outputId/download` - Download output (two-step process)

**Prompt:**
```
Create all backend API endpoints as proxy endpoints to the Autodesk Platform Services API. Add the x-ads-region: US header to all APS API calls. Handle authentication by forwarding the Authorization header from the frontend. Implement proper error handling and response transformation (removing "b." prefixes from IDs).
```

### All APS API Calls
- Add header: `x-ads-region: US`
- Use `Authorization: Bearer {token}` header

**Prompt:**
```
Ensure all API calls to Autodesk Platform Services include the x-ads-region: US header and use Authorization: Bearer {token} for authentication.
```

## UI Components

### 35. Product Cards
- Clickable cards with hover effects
- Selected state styling
- Expandable to show variants
- Display: name, thumbnail, GLB preview, release dropdown, state, date

**Prompt:**
```
Style product cards with hover effects and selected state styling. Make cards clickable and expandable to show variants. Display product name, thumbnail, GLB preview, release dropdown, state, and date in each card.
```

### 36. Variant Cards
- Expandable items in variants list
- Display: thumbnail (50px), name, ID, description
- Expand to show: parameters, preview (GLB/thumbnail), downloads section

**Prompt:**
```
Style variant cards as expandable items in the variants list. Display a 50px thumbnail, variant name, ID, and description. When expanded, show parameters section, preview section (GLB/thumbnail), and downloads section.
```

### 37. Loading States
- Spinner animations for all async operations
- Status messages during generation
- Disable buttons during processing

**Prompt:**
```
Add loading states throughout the application. Show spinner animations for all async operations, display status messages during generation, and disable buttons during processing.
```

## Error Handling

### 38. Error States
- Handle 401 (unauthorized) - redirect to login
- Handle 404 (not found) - show appropriate message
- Handle 403 (forbidden) - show access denied message
- Handle network errors gracefully
- Do not log errors to console in production (remove all console.log and console.error debug statements)

**Prompt:**
```
Implement comprehensive error handling. Handle 401 errors by redirecting to login, 404 errors with appropriate messages, 403 errors with access denied messages, and network errors gracefully. Do not include console.log or console.error debug statements in production code.
```

## Security

### 39. Security Rules
- Never use user input directly in file paths or commands
- Validate all external input
- Use environment variables for secrets
- Sanitize output for HTML/CLI
- Use HTTPS for all remote calls
- Use strict equality (`===`) for comparisons

**Prompt:**
```
Implement security best practices: never use user input directly in file paths or commands, validate all external input, use environment variables for secrets, sanitize output for HTML/CLI, use HTTPS for all remote calls, and use strict equality (===) for comparisons.
```

## Final Notes

- All API calls to Informed Design should be proxied through the backend
- Remove all debug console.log statements from production code (no debug output on backend console)
- Use consistent ID normalization (remove "b." prefix) throughout
- Ensure proper error handling and loading states for all async operations
- Test with multiple products, releases, and variants
- Verify all file downloads work correctly with proper filenames and extensions
- Import/export functionality should work with both CSV and Excel formats
- Release dropdown should size to fit text horizontally (width: auto, min-width: 120px, flex-shrink: 0)
- Product thumbnails use white background to match thumbnail images
- Variant names with duplicates are automatically numbered (e.g., "Standard 1", "Standard 2")
- Variant IDs are not displayed in the UI

**Prompt:**
```
Review the entire application to ensure: all API calls are proxied through the backend, no debug console.log statements remain in production code, ID normalization is consistent, error handling and loading states are proper, import/export works with both CSV and Excel formats, product thumbnails have white backgrounds, duplicate variant names are numbered, and variant IDs are not displayed. Verify the release dropdown sizes correctly to fit text horizontally.
```
