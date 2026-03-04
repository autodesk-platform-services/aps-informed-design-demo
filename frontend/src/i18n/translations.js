// Translation strings for English and Japanese
export const translations = {
  en: {
    // Menu bar
    account: "Account",
    selectAccount: "Select Account",
    project: "Project",
    selectProject: "Select a Project",
    
    // User menu
    getMyToken: "Get my token",
    showIds: "Show IDs",
    apsApps: "APS Apps",
    logout: "Logout",
    user: "User",
    
    // Language selector
    language: "Language",
    english: "English",
    japanese: "日本語",
    
    // Login page (keep in English as requested)
    loginTitle: "Informed Design Demo",
    loginSubtitle: "Sign in with your Autodesk account",
    loginButton: "Login with Autodesk",
    error: "Error",
    checkConsole: "Check the browser console (F12) for details",
    
    // Folders
    selectFolder: "Select Folder",
    pleaseSelectFolder: "Please select a folder to display products.",
    projectFiles: "Project Files",
    noFolders: "No folders found",
    loadingFolders: "Loading folders...",
    
    // Products
    products: "Products",
    noProducts: "No products found",
    loadingProducts: "Loading products...",
    
    // Projects
    projects: "Projects",
    dataExchange: "Data Exchanges",
    selectProduct: "Select Product",
    selectFile: "Select File",
    loadingFiles: "Loading files...",
    selectedFile: "Selected File",
    selectProjectToViewFiles: "Select a project to view files.",
    backToProducts: "Back to Products",
    state: "State",
    releaseDate: "Release Date",
    default: "Default",
    
    // Releases
    releases: "Releases",
    release: "Release",
    noReleases: "No releases found",
    loadingReleases: "Loading releases...",
    
    // Variants
    variants: "Variants",
    variant: "Variant",
    noVariants: "No variants found",
    loadingVariants: "Loading variants...",
    addVariant: "Add Variant",
    createVariant: "Create Variant",
    create: "Create",
    validating: "Validating...",
    delete: "Delete",
    deleteVariant: "Delete Variant",
    confirmDelete: "Are you sure you want to delete this variant?",
    export: "Export",
    exportVariants: "Export Variants",
    exportProducts: "Export Products",
    import: "Import",
    importVariants: "Import Variants",
    generate: "Generate",
    generateOutputsForAllVariants: "Generate Outputs for All Variants",
    selectOutputTypesToGenerate: "Select output types to generate for all variants in this release:",
    loadingOutputTypes: "Loading output types...",
    selectFileToImportVariants: "Select a CSV or Excel file to import variants",
    orDragAndDropFile: "Or drag and drop a file here",
    dismissError: "Dismiss error",
    copy: "Copy {label}",
    
    // Variant form
    variantName: "Variant Name",
    name: "Name",
    value: "Value",
    type: "Type",
    description: "Description",
    min: "Min",
    max: "Max",
    createNewVariant: "Create New Variant",
    loadingInputs: "Loading inputs...",
    loadingRules: "Loading rules...",
    loadingValidationRules: "Loading validation rules...",
    creating: "Creating...",
    
    // Parameters
    parameters: "Parameters",
    noParameters: "No parameters available",
    loadingParameters: "Loading parameters...",
    notAvailable: "N/A",
    inputNumber: "Input {number}",
    model: "Model",
    thumbnail: "Thumbnail",
    noModelAvailable: "No model available",
    noThumbnailAvailable: "No thumbnail available",
    noOutputTypesAvailable: "No output types available for this release.",
    noReleasesAvailable: "No releases available",
    noVariantsAvailable: "No variants available",
    selectOutputType: "Select output type...",
    selectRepresentation: "Select representation...",
    failedToGenerateOutput: "Failed to generate output",
    status: "Status",
    
    // Status values
    status_PENDING: "Pending",
    status_IN_PROGRESS: "In Progress",
    status_INPROGRESS: "In Progress",
    status_PROCESSING: "Processing",
    status_DOWNLOADING: "Downloading",
    status_SUCCESS: "Success",
    status_FAILURE: "Failure",
    status_FAILED: "Failed",
    status_DOWNLOADED: "Downloaded",
    
    // Downloads
    downloads: "Downloads",
    outputType: "Output Type",
    representation: "Representation",
    download: "Download",
    view: "View",
    generating: "Generating...",
    generatingWithStatus: "Generating... ({status})",
    downloading: "Downloading...",
    downloaded: "Downloaded",
    failed: "Failed - Try Again",
    failedRetry: "Failed - Retry",
    ready: "Ready",
    
    // Preview
    preview: "Preview",
    loadingPreview: "Loading preview...",
    noPreview: "No preview available",
    
    // Viewer
    loading3DModel: "Loading 3D model...",
    loading3DModelSubtitle: "This may take a moment while the model is being prepared",
    
    // Dialogs
    tokenDialog: {
      title: "3LO Token",
      label: "Your 3LO Access Token:",
      copy: "Copy to Clipboard",
      copied: "✓ Copied!",
      noToken: "No token found",
      copyError: "Failed to copy token"
    },
    idsDialog: {
      title: "IDs",
      accountId: "Account ID",
      projectId: "Project ID",
      folderUrn: "Folder URN",
      productId: "Product ID",
      releaseId: "Release ID",
      variantId: "Variant ID",
      copyAll: "Copy All to Clipboard",
      allCopied: "✓ All Copied!",
      notSelected: "Not selected",
      notAvailable: "Not available",
      copyError: "Failed to copy {label}",
      copyAllError: "Failed to copy all IDs"
    },
    apsAppsDialog: {
      title: "APS Apps",
      currentApp: "Current App",
      appName: "APS App Name",
      clientId: "APS Client Id",
      clientSecret: "APS Secret",
      switchApp: "Switch Apps",
      save: "Save",
      cancel: "Cancel",
      allFieldsRequired: "All fields are required",
      switchError: "Failed to switch app"
    },
    
    // Import/Export
    dropFile: "Drop a CSV or Excel file here",
    importProgress: "Importing {current} of {total}...",
    importComplete: "Import complete: {success} succeeded, {fail} failed",
    importError: "Error importing variants: {error}",
    noValidVariants: "No valid variants found in file",
    confirmImport: "Import {count} variant(s)?",
    fileTypeError: "Please drop a CSV or Excel file (.csv, .xlsx, or .xls)",
    notAuthenticated: "Not authenticated. Please log in again.",
    
    // Validation
    validationError: "Validation Error",
    willBeCorrected: "Will be corrected to: {value}",
    dismiss: "Dismiss",
    
    // Status messages
    loading: "Loading...",
    errorOccurred: "An error occurred",
    tryAgain: "Try Again",
    
    // Common
    close: "Close",
    cancel: "Cancel",
    save: "Save",
    ok: "OK",
    yes: "Yes",
    no: "No",
    noProjects: "No projects",
    selectAccountFirst: "Select Account first",
    selectProjectToViewFolders: "Select a project to view folders.",
    loadingThumbnail: "Loading thumbnail...",
    switching: "Switching...",
    
    // RVT File Properties
    backToProjects: "Back to Projects",
    backToDataExchanges: "Back to Data Exchanges",
    rvtFile: "RVT File",
    details: "Details",
    properties: "Properties",
    fileId: "File ID",
    fileType: "File Type",
    extension: "Extension",
    version: "Version",
    fileSize: "File Size",
    created: "Created",
    lastModified: "Last Modified",
    by: "by",
    open3DViewer: "Open 3D Viewer",
    openAutodeskViewer: "Open in Autodesk Viewer",
    viewerNotAvailable: "3D Viewer not available for this file type",
    selectFileToPreview: "Select a file to preview",
    thumbnailNotAvailable: "Thumbnail not available",
    select3DView: "Select 3D View",
    projectPanelTitle: "PROJECT",
    selectFileToViewDetails: "Select a file from the list to view its details.",
    dataExchangePanelTitle: "DATA EXCHANGE",
    selectDataExchangeFromList: "Select a Data Exchange from the list."
  },
  ja: {
    // Menu bar
    account: "アカウント",
    selectAccount: "アカウントを選択",
    project: "プロジェクト",
    selectProject: "プロジェクトを選択",
    
    // User menu
    getMyToken: "トークンを取得",
    showIds: "IDを表示",
    apsApps: "APSアプリ",
    logout: "ログアウト",
    user: "ユーザー",
    
    // Language selector
    language: "言語",
    english: "English",
    japanese: "日本語",
    
    // Login page (keep in English as requested)
    loginTitle: "Informed Design Demo",
    loginSubtitle: "Sign in with your Autodesk account",
    loginButton: "Login with Autodesk",
    error: "Error",
    checkConsole: "Check the browser console (F12) for details",
    
    // Folders
    selectFolder: "フォルダを選択",
    pleaseSelectFolder: "製品を表示するにはフォルダを選択してください。",
    projectFiles: "プロジェクトファイル",
    noFolders: "フォルダが見つかりません",
    loadingFolders: "フォルダを読み込み中...",
    
    // Products
    products: "製品",
    noProducts: "製品が見つかりません",
    loadingProducts: "製品を読み込み中...",
    
    // Projects
    projects: "プロジェクト",
    dataExchange: "データ交換",
    selectProduct: "製品を選択",
    selectFile: "ファイルを選択",
    loadingFiles: "ファイルを読み込み中...",
    selectedFile: "選択されたファイル",
    selectProjectToViewFiles: "プロジェクトを選択してファイルを表示します。",
    backToProducts: "製品に戻る",
    state: "状態",
    releaseDate: "リリース日",
    default: "デフォルト",
    
    // Releases
    releases: "リリース",
    release: "リリース",
    noReleases: "リリースが見つかりません",
    loadingReleases: "リリースを読み込み中...",
    
    // Variants
    variants: "バリアント",
    variant: "バリアント",
    noVariants: "バリアントが見つかりません",
    loadingVariants: "バリアントを読み込み中...",
    addVariant: "バリアントを追加",
    createVariant: "バリアントを作成",
    create: "作成",
    validating: "検証中...",
    delete: "削除",
    deleteVariant: "バリアントを削除",
    confirmDelete: "このバリアントを削除してもよろしいですか？",
    export: "エクスポート",
    exportVariants: "バリアントをエクスポート",
    exportProducts: "製品をエクスポート",
    import: "インポート",
    importVariants: "バリアントをインポート",
    generate: "生成",
    generateOutputsForAllVariants: "すべてのバリアントの出力を生成",
    selectOutputTypesToGenerate: "このリリースのすべてのバリアントに対して生成する出力タイプを選択:",
    loadingOutputTypes: "出力タイプを読み込み中...",
    selectFileToImportVariants: "バリアントをインポートするCSVまたはExcelファイルを選択",
    orDragAndDropFile: "または、ここにファイルをドラッグ&ドロップ",
    dismissError: "エラーを閉じる",
    copy: "{label}をコピー",
    
    // Variant form
    variantName: "バリアント名",
    name: "名前",
    value: "値",
    type: "タイプ",
    description: "説明",
    min: "最小",
    max: "最大",
    createNewVariant: "新しいバリアントを作成",
    loadingInputs: "入力項目を読み込み中...",
    loadingRules: "ルールを読み込み中...",
    loadingValidationRules: "検証ルールを読み込み中...",
    creating: "作成中...",
    
    // Parameters
    parameters: "パラメータ",
    noParameters: "パラメータがありません",
    loadingParameters: "パラメータを読み込み中...",
    notAvailable: "利用不可",
    inputNumber: "入力 {number}",
    model: "モデル",
    thumbnail: "サムネイル",
    noModelAvailable: "モデルがありません",
    noThumbnailAvailable: "サムネイルがありません",
    noOutputTypesAvailable: "このリリースに利用可能な出力タイプがありません。",
    noReleasesAvailable: "リリースがありません",
    noVariantsAvailable: "バリアントがありません",
    selectOutputType: "出力タイプを選択...",
    selectRepresentation: "表現を選択...",
    failedToGenerateOutput: "出力の生成に失敗しました",
    status: "ステータス",
    
    // Status values
    status_PENDING: "保留中",
    status_IN_PROGRESS: "進行中",
    status_INPROGRESS: "進行中",
    status_PROCESSING: "処理中",
    status_DOWNLOADING: "ダウンロード中",
    status_SUCCESS: "成功",
    status_FAILURE: "失敗",
    status_FAILED: "失敗",
    status_DOWNLOADED: "ダウンロード済み",
    
    // Downloads
    downloads: "ダウンロード",
    outputType: "出力タイプ",
    representation: "表現",
    download: "ダウンロード",
    view: "表示",
    generating: "生成中...",
    generatingWithStatus: "生成中... ({status})",
    downloading: "ダウンロード中...",
    downloaded: "ダウンロード済み",
    failed: "失敗 - 再試行",
    failedRetry: "失敗 - 再試行",
    ready: "準備完了",
    
    // Preview
    preview: "プレビュー",
    loadingPreview: "プレビューを読み込み中...",
    noPreview: "プレビューがありません",
    
    // Viewer
    loading3DModel: "3Dモデルを読み込み中...",
    loading3DModelSubtitle: "モデルの準備中です。しばらくお待ちください",
    
    // Dialogs
    tokenDialog: {
      title: "3LOトークン",
      label: "3LOアクセストークン:",
      copy: "クリップボードにコピー",
      copied: "✓ コピーしました！",
      noToken: "トークンが見つかりません",
      copyError: "トークンのコピーに失敗しました"
    },
    idsDialog: {
      title: "ID",
      accountId: "アカウントID",
      projectId: "プロジェクトID",
      folderUrn: "フォルダURN",
      productId: "製品ID",
      releaseId: "リリースID",
      variantId: "バリアントID",
      copyAll: "すべてをクリップボードにコピー",
      allCopied: "✓ すべてコピーしました！",
      notSelected: "未選択",
      notAvailable: "利用不可",
      copyError: "{label}のコピーに失敗しました",
      copyAllError: "すべてのIDのコピーに失敗しました"
    },
    apsAppsDialog: {
      title: "APSアプリ",
      currentApp: "現在のアプリ",
      appName: "APSアプリ名",
      clientId: "APSクライアントID",
      clientSecret: "APSシークレット",
      switchApp: "アプリを切り替え",
      save: "保存",
      cancel: "キャンセル",
      allFieldsRequired: "すべてのフィールドが必要です",
      switchError: "アプリの切り替えに失敗しました"
    },
    
    // Import/Export
    dropFile: "CSVまたはExcelファイルをここにドロップ",
    importProgress: "{total}件中{current}件をインポート中...",
    importComplete: "インポート完了: {success}件成功、{fail}件失敗",
    importError: "バリアントのインポートエラー: {error}",
    noValidVariants: "ファイルに有効なバリアントが見つかりません",
    confirmImport: "{count}件のバリアントをインポートしますか？",
    fileTypeError: "CSVまたはExcelファイル（.csv、.xlsx、または.xls）をドロップしてください",
    notAuthenticated: "認証されていません。再度ログインしてください。",
    
    // Validation
    validationError: "検証エラー",
    willBeCorrected: "次の値に修正されます: {value}",
    dismiss: "閉じる",
    
    // Status messages
    loading: "読み込み中...",
    errorOccurred: "エラーが発生しました",
    tryAgain: "再試行",
    
    // Common
    close: "閉じる",
    cancel: "キャンセル",
    save: "保存",
    ok: "OK",
    yes: "はい",
    no: "いいえ",
    noProjects: "プロジェクトがありません",
    selectAccountFirst: "まずアカウントを選択",
    selectProjectToViewFolders: "プロジェクトを選択してフォルダを表示します。",
    loadingThumbnail: "サムネイルを読み込み中...",
    switching: "切り替え中...",
    
    // RVT File Properties
    backToProjects: "プロジェクトに戻る",
    rvtFile: "RVTファイル",
    details: "詳細",
    properties: "プロパティ",
    fileId: "ファイルID",
    fileType: "ファイルタイプ",
    extension: "拡張子",
    version: "バージョン",
    fileSize: "ファイルサイズ",
    created: "作成日",
    lastModified: "最終更新",
    by: "作成者",
    open3DViewer: "3Dビューアを開く",
    openAutodeskViewer: "Autodeskビューアで開く",
    viewerNotAvailable: "このファイルタイプでは3Dビューアは利用できません",
    selectFileToPreview: "ファイルを選択してプレビュー",
    thumbnailNotAvailable: "サムネイルが利用できません",
    select3DView: "3Dビューを選択",
    projectPanelTitle: "プロジェクト",
    selectFileToViewDetails: "一覧からファイルを選択すると詳細が表示されます。",
    dataExchangePanelTitle: "データエクスチェンジ",
    selectDataExchangeFromList: "一覧からデータエクスチェンジを選択してください。"
  }
};

