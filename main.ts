import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, addIcon } from 'obsidian';
import { trolling } from 'icons';

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

function setIcon(cont, icon, name) {
	const old = document.querySelector('[aria-label^="Custom Sync"], [aria-label^="You"]')
	if(old != null)
		old.remove()
	var title = "Custom Sync - "+name;
	if(icon == "trolling")
		title = name

	cont.addRibbonIcon(icon, title, (evt: MouseEvent) => {
			if(icon="checkbox-glyph")
			{
				setIcon(cont, "trolling", "You just got trickaroonied!")
				document.querySelector(".trolling").currentScale = .25;
				setTimeout(()=>{setIcon(cont, "checkbox-glyph", "Up to date")}, 1750)
			}
		});
	}

//PROBABLY should exclude the plugins folder in our .obsidian
//Although idk
function rsyncwrapper(source: string, dest: string, settings: MyPluginSettings, cont, icon: string):any {

	//console.log("Syncing...\n[Source: "+source+"]\n[Dest: "+dest+"]");
	//changeRibbonIcon("Custom Sync", "clock")
	setIcon(cont, icon, "Syncing...")
	
	var rsync = new Rsync()
		.flags("rqc")
		.executable(settings.cygwinPath+" -lc 'rsync")
		.set("rsh", "ssh -i "+settings.keyPath)
		.set("exclude", "*plugins") //Fuck plugins bro
		.source(source)
		.destination(dest)

	//Quick validation
	var pass = "true" //Lol
	if(settings.keyPath == "")
		pass = "No key"
	
	//console.log(rsync.command())

	if(pass === "true")
		rsync.execute(function(error, code, cmd) {
			if(error == null)
				setIcon(cont, "checkbox-glyph", "Up to date")
			else
				setIcon(cont, "cross", error)
		});
	else
		setIcon(cont, "cross", "Sync failed! \""+pass+"\"")
	
}

function rsyncdelete(localPath: string, settings: MyPluginSettings, vaultName: string, resync = true, cont) {
	//console.log("Removing old file...")
	setIcon(cont, "sheets-in-box", "Processing changed file...")

	localPath = "/cygdrive/c/"+localPath;
	var rsync = new Rsync()
		.flags("r")
		.executable(settings.cygwinPath+" -lc 'rsync")
		.set("rsh", "ssh -i "+settings.keyPath)
		.set("delete")
		.source(localPath+vaultName)
		.destination(settings.remoteUrl+":"+settings.remotePath)

	//Quick validation
	var pass = "true" //Lol
	if(settings.keyPath == "")
		pass = "No key"
	
	//console.log(rsync.command())

	if(pass === "true")
		rsync.execute(function(error, code, cmd) {
			if(error == null) {
				if(resync) //If the file was moved, we resync to put its new location on the server
					rsyncwrapper(localPath+vaultName, settings.remoteUrl+":"+settings.remotePath, settings, cont, "up-arrow-with-tail")
			}
			else
				setIcon(cont, "cross", error)
		});
	else
	setIcon(cont, "cross", "Sync failed! \""+pass+"\"")
}

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;

	async onload() {
		await this.loadSettings();
		
		//Clean this up eventually
		//"Globals"
		const debug = false;
		const vaultName = this.app.vault.getName();
		const keyPath = this.settings.keyPath;//"/cygdrive/c/Users/baker/.ssh/id_rsa";
		const remote = this.settings.remoteUrl+":"+this.settings.remotePath;
		//TODO make it so we detect if on Windows to prepend the cygdrive bs
		const local = "/cygdrive/c/"+this.app.vault.adapter.basePath.slice(3, -vaultName.length);
		const settings = this.settings
		var app = this.app
		var cont = this;
		addIcon("trolling", trolling)
		
	
		//On load, we should sync from server to local.
		this.registerEvent(this.app.workspace.on("css-change", ()=> {
			rsyncwrapper(remote+vaultName, local, this.settings, cont, "down-arrow-with-tail")
		}))

		//New Vault created, see if it exists on remote and if not put it there.
		//If it does exist, move from remote to local. This really shouldn't be that big a deal but we might encounter it.
		
		//On Vault save, sync to remote 
		this.registerEvent(this.app.vault.on("modify", ()=>{
			rsyncwrapper(local+vaultName, remote, this.settings, cont, "up-arrow-with-tail")
			}));

		//On file delete
		this.registerEvent(this.app.vault.on('delete', function(file){
			rsyncdelete(app.vault.adapter.basePath.slice(3, -vaultName.length), settings, vaultName, false, cont) //Slice is WINDOWS ONLY
		}));

		//On file move/rename
		this.registerEvent(this.app.vault.on('rename', function(file, oldPath){
			rsyncdelete(app.vault.adapter.basePath.slice(3, -vaultName.length), settings, vaultName, true, cont) //Slice is WINDOWS ONLY
		}));

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SampleSettingTab(this.app, this));
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
