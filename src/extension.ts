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
    // Primary extension ID for configuration and logging
    primaryExtensionId: string;
    // Register mode change events
    register(context: vscode.ExtensionContext, onModeChange: (mode: any) => void): void;
    // Determine if a mode is Normal mode
    isNormalMode(mode: any): boolean;
}

/**
 * Base observer with common functionality
 */
abstract class BaseModalEditorObserver implements IModalEditorObserver {
    extensionIds: string[] = [];
    primaryExtensionId: string = '';
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
     */
    abstract register(context: vscode.ExtensionContext, onModeChange: (mode: any) => void): void;
}

/**
 * VSCodeVim observer
 */
class VSCodeVimObserver extends BaseModalEditorObserver {
    // Support multiple VSCodeVim variants
    extensionIds = ['vscodevim.vim']; 
    primaryExtensionId = 'vscodevim.vim';
    
    // VSCodeVim-specific mode detection if needed
    isNormalMode(mode: any): boolean {
        // VSCodeVim uses simple string mode names
        if (typeof mode === 'string') {
            return mode.toLowerCase() === 'normal';
        }
        // Fall back to generic strategy for other formats
        return super.isNormalMode(mode);
    }
    
    register(context: vscode.ExtensionContext, onModeChange: (mode: any) => void): void {
        // TODO: API not verified, not implemented yet
        debugChannel.appendLine(`VSCodeVim API not verified, integration not implemented yet`);
    }
}

/**
 * Neovim observer
 */
class NeovimObserver extends BaseModalEditorObserver {
    // Support multiple Neovim variants
    extensionIds = ['asvetliakov.vscode-neovim', 'vscode-neovim.vscode-neovim'];
    primaryExtensionId = 'asvetliakov.vscode-neovim';
    
    isNormalMode(mode: any): boolean {
        // Use default strategy for now, can be specialized later
        return super.isNormalMode(mode);
    }
    
    register(context: vscode.ExtensionContext, onModeChange: (mode: any) => void): void {
        // TODO: API not verified, not implemented yet
        debugChannel.appendLine(`Neovim API not verified, integration not implemented yet`);
    }
}

/**
 * Dance/Helix observer
 */
class DanceHelixObserver extends BaseModalEditorObserver {
    // Support multiple Dance/Helix variants
    extensionIds = ['gregoire.dance', 'kend.dancehelixkey', 'silverquark.dancehelix'];
    primaryExtensionId = 'gregoire.dance';
    
    // Dance/Helix specific mode detection
    isNormalMode(mode: any): boolean {
        // Dance/Helix uses an object with a mode.name property
        if (mode && typeof mode === 'object' && mode.name) {
            return /^normal$/i.test(mode.name);
        }
        // Fall back to generic strategy for other formats
        return super.isNormalMode(mode);
    }
    
    register(context: vscode.ExtensionContext, onModeChange: (mode: any) => void): void {
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
                    return; // Return after successfully registering one variant
                }
            }
        }
        debugChannel.appendLine(`Failed to register any Dance/Helix variants`);
    }
}

/**
 * Modal editors manager (Factory Pattern)
 */
class ModalEditorsManager {
    private observers: Map<string, IModalEditorObserver> = new Map();
    private observersByExtensionId: Map<string, IModalEditorObserver> = new Map();
    private defaultModeDetectionStrategy: IModeDetectionStrategy = new GenericModeDetectionStrategy();
    
    constructor() {
        // Register all known editor observers
        this.registerObserver(new VSCodeVimObserver());
        this.registerObserver(new NeovimObserver());
        this.registerObserver(new DanceHelixObserver());
    }
    
    /**
     * Register a modal editor observer
     */
    registerObserver(observer: IModalEditorObserver): void {
        // Use primary extension ID as key
        this.observers.set(observer.primaryExtensionId, observer);
        
        // Create mappings for each extension ID variant
        for (const extensionId of observer.extensionIds) {
            this.observersByExtensionId.set(extensionId, observer);
        }
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
        return this.observers.get(extensionId) || this.observersByExtensionId.get(extensionId);
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
            await this.api.switchToEnglishIM();
            debugChannel.appendLine('Successfully switched to English input method');
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
            // Auto mode: try to set up all known modal editors
            for (const observer of this.modalEditorsManager.getAllObservers()) {
                try {
                    observer.register(context, handleModeChange);
                } catch (error) {
                    debugChannel.appendLine(`Error setting up ${observer.primaryExtensionId}: ${error}`);
                }
            }
        } else {
            // Specific mode: only set up the specified modal editor
            const observer = this.modalEditorsManager.getObserver(vimExtensionType);
            if (observer) {
                try {
                    observer.register(context, handleModeChange);
                } catch (error) {
                    debugChannel.appendLine(`Error setting up ${observer.primaryExtensionId}: ${error}`);
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
