#!/bin/ruby

# Usage:
#
# assume:
# - this file is called transform.rb
# - it is in the same directory as some output from SELECT statements called output.sql
# - you want to create a new file in the same directory called output.sql

root_dir = "#{Dir.home}/sb-tmp/db-dump"
inputs = {
  phoneNumbers: "phoneNumbers.txt",
  channels: "channels.txt",
  memberships: "memberships.txt",
  messageCounts: "messageCounts.txt",
}
output = "#{root_dir}/output.txt"

File.open(output, 'w') do |out_file|
  inputs.each do |table_name, filename|
    File.readlines("#{root_dir}/#{filename}").each do |in_line|
      formatted = in_line.strip().gsub(/\s+/, ' ').split('|').map{ |x| "'#{x.strip()}'"}.join(', ')
      !formatted.empty? && out_file.write("insert into \"#{table_name.to_s}\" values(#{formatted});\n")
    end
  end
end

