import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
var Rsync = require('rsync')

// Remember to rename these classes and interfaces!

interface MyPluginSettings {
	keyPath: string;
	remoteUrl: string;
	remotePath: string;
	cygwinPath: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	keyPath: '',
	remoteUrl: '',
	remotePath: '',
	cygwinPath: 'F:/cygwin/bin/bash.exe'
	
}

//PROBABLY should exclude the plugins folder in our .obsidian
//Although idk
function rsyncwrapper(source: string, dest: string, settings: MyPluginSettings) {

	//console.log("Syncing...\n[Source: "+source+"]\n[Dest: "+dest+"]");
	
	
	var rsync = new Rsync()
		.flags("rqu")
		.executable(settings.cygwinPath+" -lc 'rsync")
		.set("rsh", "ssh -i "+settings.keyPath)
		.set("size-only")
		.set("exclude", "*plugins") //Fuck plugins bro
		.source(source)
		.destination(dest)

	//Quick validation
	var pass = "true" //Lol
	if(settings.keyPath == "")
		pass = "No key"
	
	console.log(rsync.command())

	if(pass === "true")
		rsync.execute(function(error, code, cmd) {
			if(error == null)
				console.log("Done!");
			else
				console.log(error);
		});
	else
		console.log("Sync failed! \""+pass+"\"")
	
}

function rsyncdelete(localPath: string, filePath: string, settings: MyPluginSettings, vaultName: string) {
	localPath = "/cygdrive/c/"+localPath;
	const fileName = filePath.split("/").last()
	filePath = filePath.slice(0, -fileName.length)
	var rsync = new Rsync()
		.flags("r")
		.executable(settings.cygwinPath+" -lc 'rsync")
		.set("rsh", "ssh -i "+settings.keyPath)
		.set("delete")
		.set("include", fileName)
		.set("exclude", "*")
		.source(localPath+vaultName+"/.obsidian/") //A directory not containing the file we're deleting is needed. Thank god for this one.
		.destination(settings.remoteUrl+":"+settings.remotePath+vaultName+"/"+filePath)

	//Quick validation
	var pass = "true" //Lol
	if(settings.keyPath == "")
		pass = "No key"
	
	console.log(rsync.command())
	rsync.output(
		function(data){
			console.log(data)
		}, function(data) {
			console.log("ERROR!!")
			console.log(data)
		}
	);
	if(pass === "true")
		rsync.execute(function(error, code, cmd) {
			if(error == null) {
				rsyncwrapper(localPath+vaultName, settings.remoteUrl+":"+settings.remotePath, settings)
			}
			else
				console.log(error);
		});
	else
		console.log("Sync failed! \""+pass+"\"")
}

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;

	async onload() {
		await this.loadSettings();

		//"Globals"
		const debug = false;
		const vaultName = this.app.vault.getName();
		const keyPath = this.settings.keyPath;//"/cygdrive/c/Users/baker/.ssh/id_rsa";
		const remote = this.settings.remoteUrl+":"+this.settings.remotePath;
		//TODO make it so we detect if on Windows to prepend the cygdrive bs
		const local = "/cygdrive/c/"+this.app.vault.adapter.basePath.slice(3, -vaultName.length);
		const settings = this.settings
		var app = this.app


		//On load, we should sync from server to local.
		//rsyncwrapper(remote+vaultName, local, this.settings);
		
		//Should we then sync the other way to move files that are somehow newer over? Shouldn't happen but it does in development lol

		
		//Local to server
		//rsyncwrapper(keyPath, local+vaultName, remote)



		//New Vault created, see if it exists on remote and if not put it there.
		//If it does exist, move from remote to local. This really shouldn't be that big a deal but we might encounter it.
		
		//On Vault save, sync to remote 
		this.registerEvent(this.app.vault.on("modify", ()=>{rsyncwrapper(local+vaultName, remote, this.settings)}));

		//On file delete
		this.registerEvent(this.app.vault.on('delete', function(file){
			console.log((file));
		}));

		//On file move/rename
		this.registerEvent(this.app.vault.on('rename', function(file, oldPath){
			rsyncdelete(app.vault.adapter.basePath.slice(3, -vaultName.length), oldPath, settings, vaultName) //Slice is WINDOWS ONLY
			//rsyncwrapper(local+vaultName, remote, settings) //Resync new changes
		}));


		//Keeping this for reference lol
		if(debug) {
			// This creates an icon in the left ribbon.
			const ribbonIconEl = this.addRibbonIcon('dice', 'Sample Plugin', (evt: MouseEvent) => {
				// Called when the user clicks the icon.
				new Notice('This is a notice!');
			});
			// Perform additional things with the ribbon
			ribbonIconEl.addClass('my-plugin-ribbon-class');

			// This adds a status bar item to the bottom of the app. Does not work on mobile apps.
			const statusBarItemEl = this.addStatusBarItem();
			statusBarItemEl.setText('Status Bar Text');

			// This adds a simple command that can be triggered anywhere
			this.addCommand({
				id: 'open-sample-modal-simple',
				name: 'Open sample modal (simple)',
				callback: () => {
					new SampleModal(this.app).open();
				}
			});
			// This adds an editor command that can perform some operation on the current editor instance
			this.addCommand({
				id: 'sample-editor-command',
				name: 'Sample editor command',
				editorCallback: (editor: Editor, view: MarkdownView) => {
					console.log(editor.getSelection());
					editor.replaceSelection('Sample Editor Command');
				}
			});
			// This adds a complex command that can check whether the current state of the app allows execution of the command
			this.addCommand({
				id: 'open-sample-modal-complex',
				name: 'Open sample modal (complex)',
				checkCallback: (checking: boolean) => {
					// Conditions to check
					const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
					if (markdownView) {
						// If checking is true, we're simply "checking" if the command can be run.
						// If checking is false, then we want to actually perform the operation.
						if (!checking) {
							new SampleModal(this.app).open();
						}

						// This command will only show up in Command Palette when the check function returns true
						return true;
					}
				}
			});
		}

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SampleSettingTab(this.app, this));

		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
			//console.log('click', evt);
		});

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		//this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class SampleModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		const {contentEl} = this;
		contentEl.setText('Woah!');
	}

	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}
}

class SampleSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		containerEl.createEl('h2', {text: 'Sync Settings.'});

		new Setting(containerEl)
			.setName('SSH Key Path')
			.setDesc('Your SSH Private Key, used for logging into server. Please generate the key to use no password, just wont work otherwise. If you\'re on Windows, use the cygdrive path to the key.')
			.addText(text => text
				.setPlaceholder('Enter the path to your secret key.')
				.setValue(this.plugin.settings.keyPath)
				.onChange(async (value) => {
					this.plugin.settings.keyPath = value;
					await this.plugin.saveSettings();
				}));
		new Setting(containerEl)
			.setName('Remote address')
			.setDesc('Remote server URL/IP')
			.addText(text => text
				.setPlaceholder('name@example.com')
				.setValue(this.plugin.settings.remoteUrl)
				.onChange(async (value) => {
					this.plugin.settings.remoteUrl = value;
					await this.plugin.saveSettings();
				}));
		new Setting(containerEl)
			.setName('Remote directory')
			.setDesc('Path to the remote backup folder.')
			.addText(text => text
				.setPlaceholder('~/.obsidian/sync')
				.setValue(this.plugin.settings.remotePath)
				.onChange(async (value) => {
					this.plugin.settings.remotePath = value;
					await this.plugin.saveSettings();
				}));
		new Setting(containerEl)
			.setName('Cygwin bash path')
			.setDesc('Needed for Windows.')
			.addText(text => text
				.setPlaceholder('F:/cygwin/bin/bash.exe')
				.setValue(this.plugin.settings.cygwinPath)
				.onChange(async (value) => {
					this.plugin.settings.cygwinPath = value;
					await this.plugin.saveSettings();
				}));
				
		
	}
}
