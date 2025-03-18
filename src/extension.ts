import * as vscode from 'vscode';

// Debug output channel
const debugChannel = vscode.window.createOutputChannel('NoIME');

// Global state
let imeAPI: any; // API provided by ime-and-cursor

/**
 * Mode detection strategy interface (Strategy Pattern)
 */
interface IModeDetectionStrategy {
    isNormalMode(mode: any): boolean;
}

/**
 * Generic mode detection strategy
 */
class GenericModeDetectionStrategy implements IModeDetectionStrategy {
    isNormalMode(mode: any): boolean {
        if (!mode) {return false;}
        
        if (typeof mode === 'string') {
            return /^normal$/i.test(mode) || mode === 'n';
        } else if (typeof mode === 'object') {
            // Check common properties for object-based modes
            const modeName = mode.name || mode.modeName || mode.mode;
            if (typeof modeName === 'string') {
                return /^normal$/i.test(modeName) || modeName === 'n';
            }
            
            // Check explicit mode indicators
            if (mode.isNormal === true || mode.type === 'normal') {
                return true;
            }
        }
        return false;
    }
}

/**
 * Modal editor observer interface (Observer Pattern)
 * Supports multiple extension ID variants
 */
interface IModalEditorObserver {
    // Support multiple extension IDs
    extensionIds: string[];
    // Human-friendly name for display and identification purposes
    displayName: string;
    // Register mode change events - returns true if registration succeeded
    register(context: vscode.ExtensionContext, onModeChange: (mode: any) => void): boolean;
    // Determine if a mode is Normal mode
    isNormalMode(mode: any): boolean;
}

/**
 * Base observer with common functionality
 */
abstract class BaseModalEditorObserver implements IModalEditorObserver {
    extensionIds: string[] = [];
    displayName: string = '';
    protected modeDetectionStrategy: IModeDetectionStrategy = new GenericModeDetectionStrategy();

    /**
     * Set a custom mode detection strategy
     */
    setModeDetectionStrategy(strategy: IModeDetectionStrategy): void {
        this.modeDetectionStrategy = strategy;
    }

    /**
     * Default implementation using strategy
     */
    isNormalMode(mode: any): boolean {
        return this.modeDetectionStrategy.isNormalMode(mode);
    }

    /**
     * Register with extension - must be implemented by subclasses
     * Returns true if registration succeeded, false otherwise
     */
    abstract register(context: vscode.ExtensionContext, onModeChange: (mode: any) => void): boolean;
}

/**
 * VSCodeVim observer
 */
class VSCodeVimObserver extends BaseModalEditorObserver {
    // Support multiple VSCodeVim variants
    extensionIds = ['vscodevim.vim']; 
    displayName = 'VSCode Vim';
    
    // VSCodeVim-specific mode detection if needed
    isNormalMode(mode: any): boolean {
        // VSCodeVim uses simple string mode names
        if (typeof mode === 'string') {
            return mode.toLowerCase() === 'normal';
        }
        // Fall back to generic strategy for other formats
        return super.isNormalMode(mode);
    }
    
    register(context: vscode.ExtensionContext, onModeChange: (mode: any) => void): boolean {
        // TODO: API not verified, not implemented yet
        debugChannel.appendLine(`VSCodeVim API not verified, integration not implemented yet`);
        return false; // Registration failed
    }
}

/**
 * Neovim observer
 */
class NeovimObserver extends BaseModalEditorObserver {
    // Support multiple Neovim variants
    extensionIds = ['asvetliakov.vscode-neovim', 'vscode-neovim.vscode-neovim'];
    displayName = 'Neovim';
    
    isNormalMode(mode: any): boolean {
        // Use default strategy for now, can be specialized later
        return super.isNormalMode(mode);
    }
    
    register(context: vscode.ExtensionContext, onModeChange: (mode: any) => void): boolean {
        // TODO: API not verified, not implemented yet
        debugChannel.appendLine(`Neovim API not verified, integration not implemented yet`);
        return false; // Registration failed
    }
}

/**
 * Dance/Helix observer
 */
class DanceHelixObserver extends BaseModalEditorObserver {
    // Support multiple Dance/Helix variants
    extensionIds = ['gregoire.dance', 'kend.dancehelixkey', 'silverquark.dancehelix'];
    displayName = 'Dance';
    
    // Dance/Helix specific mode detection
    isNormalMode(mode: any): boolean {
        // Dance/Helix uses an object with a mode.name property
        if (mode && typeof mode === 'object' && mode.name) {
            return /^normal$/i.test(mode.name);
        }
        // Fall back to generic strategy for other formats
        return super.isNormalMode(mode);
    }
    
    register(context: vscode.ExtensionContext, onModeChange: (mode: any) => void): boolean {
        // Try all variants
        for (const extensionId of this.extensionIds) {
            const extension = vscode.extensions.getExtension(extensionId);
            if (extension && extension.isActive) {
                const api = extension.exports;
                if (api && api.extension && api.extension.editors && api.extension.editors.onModeDidChange) {
                    context.subscriptions.push(api.extension.editors.onModeDidChange((modeObj: any) => {
                        onModeChange(modeObj?.mode?.name);
                    }));
                    debugChannel.appendLine(`Successfully registered ${extensionId} onModeDidChange event`);
                    return true; // Registration succeeded
                }
            }
        }
        debugChannel.appendLine(`Failed to register any Dance/Helix variants`);
        return false; // Registration failed
    }
}

/**
 * Cursor style based observer for fallback detection
 */
class CursorStyleObserver extends BaseModalEditorObserver {
    // This is a fallback mechanism without specific extension dependencies
    extensionIds = [];
    displayName = 'CursorStyle';
    
    private currentMode: string = 'unknown';
    private disposables: vscode.Disposable[] = [];
    
    isNormalMode(mode: any): boolean {
        if (typeof mode === 'string') {
            return mode === 'normal';
        }
        return false;
    }
    
    register(context: vscode.ExtensionContext, onModeChange: (mode: any) => void): boolean {
        // Clean up any previous registrations
        this.disposables.forEach(d => d.dispose());
        this.disposables = [];
        
        // Register editor cursor style change listener
        const cursorStyleWatcher = vscode.window.onDidChangeTextEditorOptions(e => {
            // Block-style cursors often indicate normal mode in modal editors
            const cursorStyle = e.options.cursorStyle;
            
            let detectedMode = 'unknown';
            if (cursorStyle === vscode.TextEditorCursorStyle.Block) {
                detectedMode = 'normal';
            } else if (cursorStyle === vscode.TextEditorCursorStyle.Line ||
                      cursorStyle === vscode.TextEditorCursorStyle.LineThin) {
                detectedMode = 'insert';
            } else if (cursorStyle === vscode.TextEditorCursorStyle.Underline ||
                      cursorStyle === vscode.TextEditorCursorStyle.UnderlineThin) {
                detectedMode = 'replace';
            }
            
            // Only report changes
            if (detectedMode !== this.currentMode) {
                this.currentMode = detectedMode;
                debugChannel.appendLine(`CursorStyle detected mode: ${detectedMode}`);
                onModeChange(detectedMode);
            }
        });
        
        // Register selection change listener as a secondary signal
        const selectionWatcher = vscode.window.onDidChangeTextEditorSelection(e => {
            const editor = e.textEditor;
            // Large or multiple selections may indicate visual mode
            if (e.selections.length > 1 || 
                e.selections.some(sel => !sel.isEmpty && !this.isLineEndCursor(sel, editor))) {
                if (this.currentMode !== 'visual') {
                    this.currentMode = 'visual';
                    debugChannel.appendLine('CursorStyle detected visual mode');
                    onModeChange('visual');
                }
            }
        });
        
        // Store disposables
        this.disposables.push(cursorStyleWatcher, selectionWatcher);
        context.subscriptions.push(...this.disposables);
        
        debugChannel.appendLine('Registered cursor style observer');
        return true; // Registration succeeded
    }
    
    // Helper to check if cursor is just at line end (common in normal mode)
    private isLineEndCursor(selection: vscode.Selection, editor: vscode.TextEditor): boolean {
        const line = editor.document.lineAt(selection.active.line);
        // Last position or last position minus 1 (for line feeds)
        return selection.active.character >= line.text.length - 1;
    }
}

/**
 * Modal editors manager (Factory Pattern)
 */
class ModalEditorsManager {
    private observers: Map<string, IModalEditorObserver> = new Map();
    private observersByExtensionId: Map<string, IModalEditorObserver> = new Map();
    private defaultModeDetectionStrategy: IModeDetectionStrategy = new GenericModeDetectionStrategy();
    private fallbackObserver: CursorStyleObserver;
    private registrationStatus: Map<string, boolean> = new Map();
    
    constructor() {
        // Create fallback observer
        this.fallbackObserver = new CursorStyleObserver();
        
        // Register all known editor observers
        this.registerObserver(new VSCodeVimObserver());
        this.registerObserver(new NeovimObserver());
        this.registerObserver(new DanceHelixObserver());
        // Note: We don't register CursorStyleObserver here as it's our fallback
    }
    
    /**
     * Register a modal editor observer
     */
    registerObserver(observer: IModalEditorObserver): void {
        // Use displayName as key
        this.observers.set(observer.displayName, observer);
        
        // Create mappings for each extension ID variant
        for (const extensionId of observer.extensionIds) {
            this.observersByExtensionId.set(extensionId, observer);
        }
        
        // Initialize registration status as false (not registered yet)
        this.registrationStatus.set(observer.displayName, false);
    }
    
    /**
     * Register all observers and set up fallbacks for failures
     */
    setupObserversWithFallbacks(context: vscode.ExtensionContext, onModeChange: (mode: any, extensionType?: string) => void): void {
        const failedObservers: IModalEditorObserver[] = [];
        
        // Try to register each observer
        for (const observer of this.getAllObservers()) {
            // Skip the cursor style observer itself (don't try to register it yet)
            if (observer.displayName === 'CursorStyle') {
                continue;
            }
            
            debugChannel.appendLine(`Setting up ${observer.displayName} observer`);
            
            try {
                // Try to register with specific handler
                const success = observer.register(context, (mode) => {
                    onModeChange(mode, observer.displayName);
                });
                
                // Update registration status
                this.registrationStatus.set(observer.displayName, success);
                
                // If registration failed, add to failed list for fallback
                if (!success) {
                    failedObservers.push(observer);
                    debugChannel.appendLine(`${observer.displayName} registration unsuccessful`);
                }
            } catch (error) {
                // Log error and add to failed list
                debugChannel.appendLine(`Error registering ${observer.displayName}: ${error}`);
                this.registrationStatus.set(observer.displayName, false);
                failedObservers.push(observer);
            }
        }
        
        // Check if all primary observers failed
        const allObserversFailed = Array.from(this.registrationStatus.values()).every(status => !status);

        // Register fallback observer only if all primary observers failed
        if (allObserversFailed) {
            debugChannel.appendLine('All primary observers failed, using cursor style fallback');
            
            // Register the fallback cursor style observer
            this.fallbackObserver.register(context, (mode) => {
                onModeChange(mode, 'CursorStyle');
            });
        } else if (failedObservers.length > 0) {
            // Some observers failed, but others succeeded - log but don't use fallback
            const failedNames = failedObservers.map(o => o.displayName).join(', ');
            debugChannel.appendLine(`Some observers failed (${failedNames}), but using successful observers`);
        }

        // Log summary of observer registration status
        debugChannel.appendLine('Observer registration summary:');
        this.registrationStatus.forEach((status, name) => {
            debugChannel.appendLine(`- ${name}: ${status ? 'Success' : 'Failed'}`);
        });
    }
    
    /**
     * Check if an observer is successfully registered
     */
    isObserverRegistered(observerName: string): boolean {
        return this.registrationStatus.get(observerName) || false;
    }
    
    /**
     * Set mode detection strategy
     */
    setModeDetectionStrategy(strategy: IModeDetectionStrategy): void {
        this.defaultModeDetectionStrategy = strategy;
    }
    
    /**
     * Get modal editor observer by extension ID
     */
    getObserver(extensionId: string): IModalEditorObserver | undefined {
        return this.observersByExtensionId.get(extensionId);
    }
    
    /**
     * Get all registered observers
     */
    getAllObservers(): IModalEditorObserver[] {
        return Array.from(this.observers.values());
    }
    
    /**
     * Check if a mode is Normal mode for a specific extension type
     */
    isNormalMode(mode: any, extensionType?: string): boolean {
        if (extensionType) {
            const observer = this.getObserver(extensionType);
            if (observer) {
                return observer.isNormalMode(mode);
            }
        }
        // Fall back to default strategy if no specific observer found
        return this.defaultModeDetectionStrategy.isNormalMode(mode);
    }
    
    /**
     * Get available extension ID options (for configuration)
     */
    getAvailableExtensionOptions(): string[] {
        return ['auto', ...Array.from(this.observers.keys())];
    }
}

/**
 * IME service
 */
class IMEService {
    private api: any;
    
    setAPI(api: any): void {
        this.api = api;
    }
    
    async switchToEnglishIM(): Promise<void> {
        if (!this.api) {
            debugChannel.appendLine('IME API not initialized');
            return;
        }
        
        try {
            if (await this.api.obtainIM() === this.api.getChineseIM()) {
                await this.api.switchToEnglishIM();
            debugChannel.appendLine('Successfully switched to English input method');
            } else {
                debugChannel.appendLine('Not using CJK input method, skipping switch');
            }
        } catch (error) {
            debugChannel.appendLine(`Error switching input method: ${error}`);
        }
    }
}

/**
 * NoIME application main controller
 */
class NoIMEController {
    private modalEditorsManager: ModalEditorsManager;
    private imeService: IMEService;
    
    constructor(modalEditorsManager: ModalEditorsManager, imeService: IMEService) {
        this.modalEditorsManager = modalEditorsManager;
        this.imeService = imeService;
    }
    
    /**
     * Initialize extension
     */
    async initialize(context: vscode.ExtensionContext): Promise<void> {
        debugChannel.appendLine('NoIME extension initializing');
        
        // Get ime-and-cursor extension API
        await this.setupIMEAPI();
        
        // Set up mode detection
        this.setupModalEditorDetection(context);
        
        // Register configuration change listener
        this.registerConfigurationChangeListener(context);
        
        // Show debug channel
        debugChannel.show(true);
    }
    
    /**
     * Set up IME API
     */
    private async setupIMEAPI(): Promise<void> {
        const imeExtension = vscode.extensions.getExtension('beishanyufu.ime-and-cursor');
        if (imeExtension) {
            if (imeExtension.isActive) {
                this.imeService.setAPI(imeExtension.exports);
                debugChannel.appendLine('Successfully obtained IME API');
            } else {
                debugChannel.appendLine('Waiting for IME extension to activate...');
                try {
                    const api = await imeExtension.activate();
                    this.imeService.setAPI(api);
                    debugChannel.appendLine('Successfully obtained IME API');
                } catch (error) {
                    debugChannel.appendLine(`Failed to activate IME extension: ${error}`);
                }
            }
        } else {
            vscode.window.showErrorMessage('ime-and-cursor extension not found. This extension cannot work properly.');
            debugChannel.appendLine('ime-and-cursor extension not found');
        }
    }
    
    /**
     * Set up mode detection
     */
    private setupModalEditorDetection(context: vscode.ExtensionContext): void {
        const config = vscode.workspace.getConfiguration('noime');
        const vimExtensionType = config.get('vimExtension') as string;
        
        debugChannel.appendLine(`Setting up modal editor mode detection, extension type: ${vimExtensionType}`);
        
        // Create mode change handler function
        const handleModeChange = async (mode: any, extensionType?: string): Promise<void> => {
            if (!mode) {return;}
            
            debugChannel.appendLine(`Handling mode change: ${typeof mode === 'string' ? mode : JSON.stringify(mode)}`);
            
            // Use observer-specific mode detection
            let isNormal = false;
            if (extensionType) {
                const observer = this.modalEditorsManager.getObserver(extensionType);
                if (observer) {
                    isNormal = observer.isNormalMode(mode);
                } else {
                    isNormal = this.modalEditorsManager.isNormalMode(mode);
                }
            } else {
                isNormal = this.modalEditorsManager.isNormalMode(mode);
            }
            
            if (isNormal) {
                debugChannel.appendLine('Normal mode detected, switching to English input method');
                await this.imeService.switchToEnglishIM();
            }
        };
        
        if (vimExtensionType === 'auto') {
            // Auto mode: set up all observers with automatic fallbacks
            this.modalEditorsManager.setupObserversWithFallbacks(context, handleModeChange);
        } else {
            // Specific mode: set up just the requested observer with fallback if needed
            const observer = this.modalEditorsManager.getObserver(vimExtensionType);
            if (observer) {
                try {
                    const success = observer.register(context, (mode) => {
                        handleModeChange(mode, observer.displayName);
                    });
                    
                    // If registration failed, use fallback
                    if (!success) {
                        debugChannel.appendLine(`${observer.displayName} registration failed, using cursor style fallback`);
                        const fallback = new CursorStyleObserver();
                        fallback.register(context, (mode) => {
                            handleModeChange(mode, observer.displayName);
                        });
                    }
                } catch (error) {
                    debugChannel.appendLine(`Error setting up ${observer.displayName}, using fallback: ${error}`);
                    const fallback = new CursorStyleObserver();
                    fallback.register(context, (mode) => {
                        handleModeChange(mode, observer.displayName);
                    });
                }
            } else {
                debugChannel.appendLine(`No matching handler found for: ${vimExtensionType}`);
            }
        }
    }
    
    /**
     * Register configuration change listener
     */
    private registerConfigurationChangeListener(context: vscode.ExtensionContext): void {
        context.subscriptions.push(
            vscode.workspace.onDidChangeConfiguration(e => {
                if (e.affectsConfiguration('noime')) {
                    debugChannel.appendLine('Configuration changed, reloading');
                    
                    // Reset mode detection
                    this.setupModalEditorDetection(context);
                }
            })
        );
    }
}

// Application singleton
let controller: NoIMEController;

// Activate extension
export async function activate(context: vscode.ExtensionContext): Promise<void> {
    debugChannel.appendLine('NoIME extension activated');
    
    // Create manager and service
    const modalEditorsManager = new ModalEditorsManager();
    const imeService = new IMEService();
    
    // Create and initialize controller
    controller = new NoIMEController(modalEditorsManager, imeService);
    await controller.initialize(context);
}

// Deactivate extension
export function deactivate(): void {
    debugChannel.appendLine('NoIME extension deactivated');
}
