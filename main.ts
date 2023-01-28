import { App, Plugin, PluginSettingTab, Setting, addIcon, debounce } from 'obsidian';
import { trolling } from 'icons';

/* eslint @typescript-eslint/no-var-requires: "off" */
const os = require('os');
const Rsync = require('rsync');

// Remember to rename these classes and interfaces!

interface RsyncPluginSettings {
	enabled: boolean;
	debug: boolean;
	keyPath: string;
	remoteUrl: string;
	remotePath: string;
}

const DEFAULT_SETTINGS: RsyncPluginSettings = {
	enabled: false,
	debug: false,
	keyPath: '',
	remoteUrl: '',
	remotePath: '',
}

function setIcon(cont: { addRibbonIcon: (arg0, arg1: string, arg2: (evt: MouseEvent) => void) => void; }, icon: string, name: string) {
	const old = document.querySelector('[aria-label^="Custom Sync"], [aria-label^="You"]')
	if(old != null)
		old.remove()
	let title = "Custom Sync - "+name;
	if(icon == "trolling")
		title = name

	cont.addRibbonIcon(icon, title, (evt: MouseEvent) => {
		//evt.button:
		//0 = left click
		//1 = middle click
		//2 = right click
		if(icon=="checkmark" && evt.button == 1 && evt.buttons == 0) //Possible bugs when pressing multiple buttons if buttons == 0 isn't here
		{
			setIcon(cont, "trolling", "You just got trickaroonied!")
			document.querySelector(".trolling").currentScale = .25;
			setTimeout(()=>{setIcon(cont, "checkmark", "Up to date")}, 1750)
		}
	});
}

function rsyncwrapper(source: string, dest: string, settings: RsyncPluginSettings, cont, icon: string, force = false) {
	if(!settings.enabled && !force)
		return;
	//console.log("Syncing...\n[Source: "+source+"]\n[Dest: "+dest+"]");
	//changeRibbonIcon("Custom Sync", "clock")
	setIcon(cont, icon, "Syncing...")
	let executable = "rsync" ;
	let rsh = "ssh" ;
	if(os.platform() == "win32")
	{
		executable = this.app.vault.adapter.basePath+"/.obsidian/plugins/custom-sync/lib/rsync/bin/rsync.exe" ;
		rsh = this.app.vault.adapter.basePath+"/.obsidian/plugins/custom-sync/lib/rsync/bin/ssh.exe"
	}

	const rsync = new Rsync()
		.flags("rqc")
		.executable(executable)
		.set("rsh", rsh+ " -i "+settings.keyPath)
		.set("exclude", "*plugins") //Exclude plugins
		.source(source)
		.destination(dest)

	rsync.cwd(this.app.vault.adapter.basePath.slice(0, -this.app.vault.getName().length))

	if(settings.debug)
	{
		console.log("Working Directory")
		console.log(rsync.cwd())
		console.log("Command")
		console.log(rsync.command())
	}

	//Quick validation
	let pass = "true" //Lol
	if(settings.keyPath == "")
		pass = "No key"

	if(pass === "true")
	{
		rsync.execute(function(error) {
			if(error == null)
				setIcon(cont, "checkmark", "Up to date")
			else
				setIcon(cont, "cross", error)
		});	
	}
	else
		setIcon(cont, "cross", "Sync failed! \""+pass+"\"")
	
}

//Moving/deleting of a file
function rsyncdelete(localPath: string, settings: RsyncPluginSettings, vaultName: string, resync = true, cont) {
	if(!settings.enabled)
		return;

	if(resync)
		setIcon(cont, "sheets-in-box", "Processing file change...")
	else
		setIcon(cont, "trash", "Deleting file...")


	let executable = "rsync" ;
	let rsh = "ssh" ;
	if(os.platform() == "win32")
	{
		executable = this.app.vault.adapter.basePath+"/.obsidian/plugins/custom-sync/lib/rsync/bin/rsync.exe" ;
		rsh = this.app.vault.adapter.basePath+"/.obsidian/plugins/custom-sync/lib/rsync/bin/ssh.exe"
	}
	
	const rsync = new Rsync()
		.flags("r")
		.executable(executable)
		.set("rsh", rsh+ " -i "+settings.keyPath)
		.set("delete")
		.set("size-only")
		.set("exclude", "*plugins") //Exclude plugins
		.source(localPath+vaultName)
		.destination(settings.remoteUrl+":"+settings.remotePath)

	rsync.cwd(this.app.vault.adapter.basePath.slice(0, -this.app.vault.getName().length))

	if(settings.debug)
	{		
		console.log("Working Directory")
		console.log(rsync.cwd())
		console.log("Command")
		console.log(rsync.command())
	}

	//Quick validation
	let pass = "true" //Lol
	if(settings.keyPath == "")
		pass = "No key"
	
	//console.log(rsync.command())

	if(pass === "true")
	{
		rsync.execute(function(error) {
			if(error == null) {
				if(resync) //If the file was moved, we resync to put its new location on the server
					rsyncwrapper(vaultName, settings.remoteUrl+":"+settings.remotePath, settings, cont, "up-arrow-with-tail")
				else
					setIcon(cont, "checkmark", "Up to date")
			}
			else
				setIcon(cont, "cross", error)
		});
	}
	else
	{
		setIcon(cont, "cross", "Sync failed! \""+pass+"\"")
	}
}

export default class RsyncPlugin extends Plugin {
	settings: RsyncPluginSettings;

	async onload() {
		await this.loadSettings();
		
		//Clean this up eventually
		//"Globals"
		const vaultName = this.app.vault.getName();
		const remote = this.settings.remoteUrl+":"+this.settings.remotePath;
		//TODO make it so we detect if on Windows to prepend the cygdrive bs
		const settings = this.settings
		addIcon("trolling", trolling)

		if(settings.enabled)
			setIcon(this, "checkmark", "Loaded")
		//List of possible rsync errors and what they mean (more or less)
		//Code 12 - No Internet
		//Code 23 - In this case, pretty sure it's "cannot find remote directory"
		

		//On obsidian start, we should sync from server to local.
		this.registerEvent(this.app.workspace.on("window-open", ()=> {
			rsyncwrapper(remote+vaultName, ".", this.settings, this, "down-arrow-with-tail")
		}))

		//New Vault created, see if it exists on remote and if not put it there.
		//If it does exist, move from remote to local. This really shouldn't be that big a deal but we might encounter it.
		//TODO

		//On Vault save, sync to remote. Debounce to 2 seconds so not every single change is sent as separate requests. (does this actually work?)
		this.registerEvent(this.app.vault.on("modify", () => {
			debounce(rsyncwrapper(vaultName, remote, this.settings, this, "up-arrow-with-tail"), 2000, true)
		}));

		//On file delete
		this.registerEvent(this.app.vault.on('delete', function(file){
			rsyncdelete("", settings, vaultName, false, this)
		}));

		//On file move/rename
		this.registerEvent(this.app.vault.on('rename', function(file, oldPath){
			rsyncdelete("", settings, vaultName, true, this)
		}));

		// This adds a settings tab so the user can configure the plugin
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
	plugin: RsyncPlugin;

	constructor(app: App, plugin: RsyncPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		containerEl.createEl('h2', {text: 'Sync Settings'});

		new Setting(containerEl)
			.setName('Enable Syncing')
			.addToggle(toggle => toggle
					.setValue(this.plugin.settings.enabled)
					.onChange(async (value) =>{
						if(value)
							setIcon(this.plugin, "checkmark", "Loaded");
						else
							document.querySelector('[aria-label^="Custom Sync"], [aria-label^="You"]').remove();
						this.plugin.settings.enabled = value;
						await this.plugin.saveSettings();					
				}));

		new Setting(containerEl)
			.setName('SSH Key Path')
			.setDesc('Path to your SSH Private Key, used for logging into server. Must be generated as passwordless.')
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
				.setPlaceholder('user@server.com')
				.setValue(this.plugin.settings.remoteUrl)
				.onChange(async (value) => {
					this.plugin.settings.remoteUrl = value;
					await this.plugin.saveSettings();
				}));
		new Setting(containerEl)
			.setName('Remote directory')
			.setDesc('Path to the remote backup folder.')
			.addText(text => text
				.setPlaceholder('~/.obsidian/sync/')
				.setValue(this.plugin.settings.remotePath)
				.onChange(async (value) => {
					if(value[value.length-1] != "/")
						value += "/"
					this.plugin.settings.remotePath = value;
					await this.plugin.saveSettings();
				}));


		containerEl.createEl('br');
		containerEl.createEl('br');
		containerEl.createEl('h2', {text: 'Manual Sync'});	

		new Setting(containerEl)
			.setName('Force a push from local to backup')
			.addButton(button => button
				.setButtonText("Force Push")
				.onClick(async () => {
					rsyncwrapper(this.app.vault.getName(), this.plugin.settings.remoteUrl+":"+this.plugin.settings.remotePath, this.plugin.settings, this.plugin, "up-arrow-with-tail", true)
				})
			);
		new Setting(containerEl)
			.setName('Force a pull from backup to local')
			.addButton(button => button
				.setButtonText("Force Pull")
				.onClick(async () => {
					rsyncwrapper(this.plugin.settings.remoteUrl+":"+this.plugin.settings.remotePath + this.app.vault.getName(), ".", this.plugin.settings, this.plugin, "down-arrow-with-tail", true)
				})
			);
		

		containerEl.createEl('br');
		containerEl.createEl('br');
		containerEl.createEl('h2', {text: 'Debug'});
		new Setting(containerEl)
			.setName('Enable Rsync Debugging')
			.setDesc('Logs the rsync working directory and command to the console for each request.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.debug)
				.onChange(async (value) =>{
					this.plugin.settings.debug = value;
					await this.plugin.saveSettings();					
				})
			);
	
	}
}
