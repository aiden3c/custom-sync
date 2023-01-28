# Obsidian Custom Sync
A plugin for syncing [Obsidian](https://obsidian.md) Vaults to/from a configured server through rsync.

Windows compatibility provided with [cwRsync's free rsync client](https://itefix.net/cwrsync?qt-cwrsync=4#qt-cwrsync).  

### Verified Platforms
- [x] Windows (tested on 10, assuming Windows 7-11 should work)
- [ ] MacOS (Need to test)
- [ ] Linux (Need to test)
- [ ] Android (if they provide their own rsync client, maybe? The NodeJS [rsync package](https://www.npmjs.com/package/rsync) has to work with it. Not sure if it does)

# How To Use
## Setting Up Your Remote Server
The remote server must have an rsync server set up and configured.

Create a directory that will contain your vaults.

For each device using the rsync plugin, generate an SSH key on that machine and add the public key to the `~/.ssh/authorized_keys` file on your server.


## Configuring Plugin
### SSH Key Path
The path to your SSH private key on the local machine. Used to authenticate with the server. The server should have the associated public key in its `~/.ssh/authorized_keys` file.

### Remote Address
The remote address of the server. Written as `username@serveraddress`. The server address can be a domain, or IP address.

### Remote Directory
The path of the backup directory on the server. Your vault will be stored in this path. It is created on initial push.


## Configuration Troubleshooting Tips
Enabling debugging in the plugin settings can be very useful for figuring out why your configuration isn't working. This will log the working directory and command being ran there to use rsync into the console.

Manually running the command provided from the debugging and adding `-v` to make the SSH portion verbose can also help trace through the communication with the server. 

The ribbon icon will have a hover tooltip with the error code on failure. Useful for general errors.


# How To Develop
This is a fork of [obsidian-sample-plugin](https://github.com/obsidianmd/obsidian-sample-plugin). Refer to their [instructions](https://github.com/obsidianmd/obsidian-sample-plugin#first-time-developing-plugins) for setting up plugins for development.
Usually just `npm i` to install packages, and `npm run dev` to compile changes as they're made.

Also, I'm not sure why this isn't directly forked. Definitely a mess-up from when I first set up the project/repo.

# Licenses
[cwRsync's free rsync client](https://itefix.net/cwrsync?qt-cwrsync=4#qt-cwrsync) uses the bare minimum executables/dlls from Rsync, Cygwin, OpenSSH, and LibreSSL to provide rsync as a command that can be ran on Windows.

All of these components, as well as cwRsync itself have their licenses for the versions packaged in this plugin listed [here](https://itefix.net/content/cwrsync-client-627)
